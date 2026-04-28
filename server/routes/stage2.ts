import { Router } from "express";
import { nanoid } from "nanoid";
import { getProject, deductCreditsAsync, getCredits, addCreditsAsync, upsertFrameJob, updateFrameJob, saveStage2Frame } from "../lib/db.js";
import { generateStoryboardFrame } from "../lib/wavespeed.js";
import { uploadUrlToGcs } from "../lib/gcs.js";
import { logCost, calculateWaveSpeedImageCost } from "../lib/cost-logger.js";
import { bqTrackProject } from "../lib/bigquery.js";
import { generationRateLimit } from "../middleware/rateLimit.js";

const router = Router();
const FRAME_CREDITS = 5;

async function generateFrame(params: {
  phone: string;
  project: ReturnType<typeof getProject> & {};
  timepointIndex: number;
}): Promise<{ imageUrl: string }> {
  const { phone, project, timepointIndex } = params;
  const timepoints = JSON.parse(project.timepoints_json!) as Array<{
    sceneDesc: string; mood: string; intensity: string; visualEffect: string;
  }>;
  const tp = timepoints[timepointIndex];
  if (!tp) throw new Error(`Timepoint ${timepointIndex} not found`);

  // Build storyboard prompt from scene description + visual effect
  const prompt = `${tp.sceneDesc}. Visual effect: ${tp.visualEffect}. Mood: ${tp.mood}. Photorealistic, cinematic.`;

  // Get character image as base64 from GCS URL if available
  let characterImageBase64: string | null = null;
  if (project.character_image_url) {
    const res = await fetch(project.character_image_url);
    if (res.ok) {
      characterImageBase64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    }
  }

  const imageUrl = await generateStoryboardFrame({ prompt, characterImageBase64 });

  // Upload to GCS for persistence
  const gcsUrl = await uploadUrlToGcs(imageUrl, "image/jpeg", "storyboard", phone);
  return { imageUrl: gcsUrl ?? imageUrl };
}

router.post("/generate-frame", generationRateLimit, async (req, res) => {
  const phone = req.user!.phone;
  const { projectId, timepointIndex } = req.body as { projectId?: string; timepointIndex?: number };

  if (!projectId || timepointIndex === undefined) {
    return res.status(400).json({ error: "projectId and timepointIndex required" });
  }

  const project = getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (project.phone !== phone) return res.status(403).json({ error: "Forbidden" });
  if (!project.timepoints_json) return res.status(400).json({ error: "Stage 1 not completed" });

  const deducted = await deductCreditsAsync(phone, FRAME_CREDITS);
  if (!deducted) {
    return res.status(402).json({ error: "Insufficient credits", credits: getCredits(phone) });
  }

  const jobId = nanoid();
  upsertFrameJob(jobId, projectId, timepointIndex);

  try {
    const { imageUrl } = await generateFrame({ phone, project: project!, timepointIndex });

    updateFrameJob(jobId, "completed", imageUrl, undefined, FRAME_CREDITS);

    // Update frames_json in project
    const existingFrames: Array<{ timepointIndex: number; imageUrl: string } | null> =
      project.frames_json ? JSON.parse(project.frames_json) : [];
    // Ensure array is large enough
    const timepoints = JSON.parse(project.timepoints_json) as unknown[];
    while (existingFrames.length < timepoints.length) existingFrames.push(null);
    existingFrames[timepointIndex] = { timepointIndex, imageUrl };

    const allDone = existingFrames.every(f => f !== null);
    saveStage2Frame(projectId, JSON.stringify(existingFrames), FRAME_CREDITS, allDone);

    logCost({ phone, service: "wavespeed", operation: "generateStoryboardFrame", model: "bytedance/seedream-v4.5/edit", costUsd: calculateWaveSpeedImageCost() });
    if (allDone) bqTrackProject({ projectId, phone, stage: "stage2", status: "completed" });

    return res.json({
      frameJobId: jobId,
      timepointIndex,
      imageUrl,
      allFramesDone: allDone,
      creditsUsed: FRAME_CREDITS,
      creditsRemaining: getCredits(phone),
    });
  } catch (err: any) {
    console.error("[Stage2] generate-frame error:", err);
    updateFrameJob(jobId, "failed", undefined, String(err));
    await addCreditsAsync(phone, FRAME_CREDITS, "refund");
    return res.status(500).json({ error: "Frame generation failed. Credits refunded." });
  }
});

router.post("/regenerate-frame", generationRateLimit, async (req, res) => {
  // Same as generate-frame — replaces the existing frame at that index
  return req.app._router.handle(
    Object.assign(req, { url: "/generate-frame", path: "/generate-frame" }),
    res,
    () => {}
  );
});

router.post("/approve", (req, res) => {
  const phone = req.user!.phone;
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) return res.status(400).json({ error: "projectId required" });

  const project = getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (project.phone !== phone) return res.status(403).json({ error: "Forbidden" });
  if (!project.frames_json) return res.status(400).json({ error: "No frames generated" });

  const frames = JSON.parse(project.frames_json) as Array<{ timepointIndex: number; imageUrl: string } | null>;
  if (frames.some(f => f === null)) {
    return res.status(400).json({ error: "Not all frames generated" });
  }

  saveStage2Frame(projectId, project.frames_json, 0, true);
  return res.json({ success: true, projectId });
});

export default router;
