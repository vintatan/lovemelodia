import { Router } from "express";
import { nanoid } from "nanoid";
import { readFile } from "fs/promises";
import { getProject, deductCreditsAsync, getCredits, addCreditsAsync, createAssemblyJob, getAssemblyJob, updateAssemblyJob, saveStage3Result } from "../lib/db.js";
import { generateMusic } from "../lib/lyria.js";
import { assembleVideo, cleanupTmpDir } from "../lib/ffmpeg.js";
import { uploadToGcs, uploadUrlToGcs } from "../lib/gcs.js";
import { logCost, calculateLyriaCost } from "../lib/cost-logger.js";
import { bqTrackProject } from "../lib/bigquery.js";
import type { Timepoint } from "../lib/db.js";

const router = Router();
const STAGE3_CREDITS = 30;

router.post("/assemble", async (req, res) => {
  const phone = req.user!.phone;
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) return res.status(400).json({ error: "projectId required" });

  const project = getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (project.phone !== phone) return res.status(403).json({ error: "Forbidden" });
  if (!project.frames_json || !project.timepoints_json) {
    return res.status(400).json({ error: "Stage 2 not completed" });
  }

  const rawFrames = JSON.parse(project.frames_json) as Array<{ timepointIndex: number; imageUrl: string } | null>;
  const frames = rawFrames.filter(f => f !== null) as Array<{ timepointIndex: number; imageUrl: string }>;
  if (frames.length < 3) {
    return res.status(400).json({ error: "Need at least 3 frames completed" });
  }

  const deducted = await deductCreditsAsync(phone, STAGE3_CREDITS);
  if (!deducted) {
    return res.status(402).json({ error: "Insufficient credits", credits: getCredits(phone) });
  }

  const assemblyJobId = nanoid();
  createAssemblyJob(assemblyJobId, projectId, phone);

  // Respond immediately with job ID — process async
  res.status(202).json({ assemblyJobId, estimatedSeconds: 120 });

  // Run async assembly
  runAssembly({ assemblyJobId, projectId, phone, project, frames }).catch(err => {
    console.error("[Stage3] assembly crash:", err);
  });
});

async function runAssembly(params: {
  assemblyJobId: string;
  projectId: string;
  phone: string;
  project: ReturnType<typeof getProject> & {};
  frames: Array<{ timepointIndex: number; imageUrl: string }>;
}): Promise<void> {
  const { assemblyJobId, projectId, phone, project, frames } = params;
  let tmpOutputPath: string | null = null;

  try {
    // Step 1: Generate music
    updateAssemblyJob(assemblyJobId, "generating_music");
    const musicPrompt = project.enhanced_prompt!;
    const musicUrlRaw = await generateMusic(musicPrompt);
    logCost({ phone, service: "wavespeed", operation: "generateMusic", costUsd: calculateLyriaCost() });

    // Upload music to GCS for durability
    const musicGcsUrl = await uploadUrlToGcs(musicUrlRaw, "audio/wav", "music", phone) ?? musicUrlRaw;
    updateAssemblyJob(assemblyJobId, "assembling_video", musicGcsUrl);

    // Step 2: Assemble video — use only the generated frames with their matching timepoints
    const allTimepoints = JSON.parse(project.timepoints_json!) as Timepoint[];
    const frameUrls = frames.map(f => f.imageUrl);
    const frameTimepoints = frames.map(f => allTimepoints[f.timepointIndex]);

    tmpOutputPath = await assembleVideo({ frameUrls, musicUrl: musicGcsUrl, timepoints: frameTimepoints });

    // Step 3: Upload final video to GCS
    updateAssemblyJob(assemblyJobId, "uploading", musicGcsUrl);
    const videoBuf = await readFile(tmpOutputPath);
    const videoGcsUrl = await uploadToGcs(videoBuf, "video/mp4", "videos", phone);
    if (!videoGcsUrl) throw new Error("GCS video upload returned null — bucket misconfigured?");

    // Step 4: Save to project
    saveStage3Result(projectId, musicGcsUrl, videoGcsUrl, STAGE3_CREDITS);
    updateAssemblyJob(assemblyJobId, "completed", musicGcsUrl, videoGcsUrl);
    bqTrackProject({ projectId, phone, stage: "stage3", status: "completed" });

    // Clean up tmp
    const dir = tmpOutputPath.replace(/\/final\.mp4$/, "");
    await cleanupTmpDir(dir);
  } catch (err: any) {
    console.error("[Stage3] assembly failed:", err);
    updateAssemblyJob(assemblyJobId, "failed", undefined, undefined, String(err));
    // Refund credits
    await addCreditsAsync(phone, STAGE3_CREDITS, "refund");
    if (tmpOutputPath) {
      const dir = tmpOutputPath.replace(/\/final\.mp4$/, "");
      await cleanupTmpDir(dir);
    }
  }
}

router.get("/status/:jobId", (req, res) => {
  const phone = req.user!.phone;
  const job = getAssemblyJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.phone !== phone) return res.status(403).json({ error: "Forbidden" });
  return res.json({
    status: job.status,
    musicUrl: job.music_url,
    videoUrl: job.video_url,
    error: job.error,
  });
});

export default router;
