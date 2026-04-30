import { Router } from "express";
import { nanoid } from "nanoid";
import path from "path";
import { readFile } from "fs/promises";
import {
  getMusicJob, createNovelJob, getNovelJob, updateNovelJob,
  getOrCreateUserAsync, deductCreditsAsync, getCredits, addCreditsAsync,
} from "../lib/db.js";
import { generateStoryboardImagePrompts, generateEnhancedPromptWithTimepoints, generateCharacterDescription } from "../lib/anthropic.js";
import { generateNanoBananaImage, generateCharacterPortrait } from "../lib/wavespeed-nano.js";
import { uploadUrlToGcs, uploadToGcs } from "../lib/gcs.js";
import { assembleVideo, cleanupTmpDir } from "../lib/ffmpeg.js";
import { createNovelJobInSupabase, updateNovelJobInSupabase } from "../lib/supabase.js";
import { logCost, calculateClaudeCost } from "../lib/cost-logger.js";
import type { Timepoint } from "../lib/db.js";

const router = Router();
const NOVEL_CREDITS = 50;

type MusicTimepoint = { timestamp: string; label: string; description: string; mood: string };

function mapToTimepoint(tp: MusicTimepoint): Timepoint {
  const intensityMap: Record<string, "low" | "medium" | "high"> = {
    euphoric: "high", triumphant: "high",
    tense: "medium", mysterious: "medium", playful: "medium",
    melancholic: "low", dreamy: "low", longing: "low",
  };
  const intensity = intensityMap[tp.mood] ?? "medium";
  const transitionMap: Record<"low" | "medium" | "high", Timepoint["transition"]> = {
    high: "wipeleft", medium: "dissolve", low: "fade",
  };
  return {
    timestamp: tp.timestamp,
    label: tp.label,
    lyricMoment: tp.description,
    sceneDesc: tp.description,
    mood: tp.mood,
    intensity,
    visualEffect: "cinematic lighting",
    transition: transitionMap[intensity],
    transitionDuration: intensity === "high" ? 0.4 : intensity === "medium" ? 0.6 : 1.0,
  };
}

async function runCapped<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<Array<T | null>> {
  const results: Array<T | null> = new Array(tasks.length).fill(null);
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const idx = cursor++;
      try { results[idx] = await tasks[idx](); } catch (err) {
        console.error(`[Novel] image task ${idx} failed:`, err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ── POST /generate — Phase 1: generate storyboard images ──────────────────────

router.post("/generate", async (req, res) => {
  const phone = req.user!.phone;
  const { musicJobId, characterImageBase64 } = req.body as {
    musicJobId?: string; characterImageBase64?: string;
  };

  if (!musicJobId) return res.status(400).json({ error: "musicJobId wajib diisi" });

  const musicJob = getMusicJob(musicJobId);
  if (!musicJob) return res.status(404).json({ error: "Music job tidak ditemukan" });
  if (musicJob.phone !== phone) return res.status(403).json({ error: "Akses ditolak" });
  if (musicJob.status !== "completed" || !musicJob.audio_url) {
    return res.status(400).json({ error: "Musik belum selesai dibuat" });
  }

  const user = await getOrCreateUserAsync(phone);
  if (user.credits < NOVEL_CREDITS) return res.status(402).json({ error: "Kredit tidak cukup", credits: user.credits });
  const deducted = await deductCreditsAsync(phone, NOVEL_CREDITS);
  if (!deducted) return res.status(402).json({ error: "Kredit tidak cukup", credits: getCredits(phone) });

  const jobId = nanoid();
  createNovelJob(jobId, musicJobId, phone);
  void createNovelJobInSupabase({ id: jobId, musicJobId, phone });

  const storedTimepointsJson = musicJob.timepoints_json;
  const enhancedPrompt = musicJob.enhanced_prompt ?? musicJob.prompt;
  const songTitle = musicJob.title ?? null;
  const songDescription = musicJob.prompt;

  (async () => {
    try {
      updateNovelJob(jobId, "generating_images");
      void updateNovelJobInSupabase(jobId, "generating_images");

      // Resolve timepoints from stored JSON or generate fresh
      let timepointsRaw: MusicTimepoint[];
      if (storedTimepointsJson) {
        timepointsRaw = JSON.parse(storedTimepointsJson) as MusicTimepoint[];
      } else {
        const { timepoints, inputTokens, outputTokens } = await generateEnhancedPromptWithTimepoints({
          genres: [],
          userDescription: songDescription,
        });
        logCost({
          phone, service: "claude", operation: "generateTimepointsForNovel",
          costUsd: calculateClaudeCost("claude-sonnet-4-6", inputTokens, outputTokens),
          inputTokens, outputTokens,
        });
        timepointsRaw = timepoints;
      }

      // Resolve or auto-generate the character reference image
      let charBase64 = characterImageBase64 ?? null;
      if (!charBase64) {
        const charDesc = await generateCharacterDescription({
          songTitle,
          songDescription,
          enhancedMusicPrompt: enhancedPrompt,
          genres: [],
        });
        logCost({ phone, service: "claude", operation: "generateCharacterDescription", costUsd: calculateClaudeCost("claude-haiku-4-5-20251001", 350, 80) });
        const charUrl = await generateCharacterPortrait(charDesc);
        const charGcsUrl = await uploadUrlToGcs(charUrl, "image/jpeg", "novels/characters", phone);
        const finalCharUrl = charGcsUrl ?? charUrl;
        const charRes = await fetch(finalCharUrl);
        const charBuf = await charRes.arrayBuffer();
        charBase64 = Buffer.from(charBuf).toString("base64");
      }

      // One cinematic image prompt per timepoint — grounded in song title + description
      const { prompts, inputTokens: pIn, outputTokens: pOut } = await generateStoryboardImagePrompts({
        songTitle,
        songDescription,
        enhancedMusicPrompt: enhancedPrompt,
        timepoints: timepointsRaw,
        genres: [],
      });
      logCost({
        phone, service: "claude", operation: "generateStoryboardPrompts",
        costUsd: calculateClaudeCost("claude-sonnet-4-6", pIn, pOut),
        inputTokens: pIn, outputTokens: pOut,
      });

      // Generate images with 3-way concurrency; push partial updates as each arrives
      const imageSlots: Array<string | null> = new Array(timepointsRaw.length).fill(null);
      const tasks = timepointsRaw.map((_, i) => async () => {
        const rawUrl = await generateNanoBananaImage(
          prompts[i] ?? "cinematic landscape, beautiful, photorealistic, atmospheric lighting",
          charBase64!,
        );
        const gcsUrl = await uploadUrlToGcs(rawUrl, "image/jpeg", "novels/images", phone);
        const url = gcsUrl ?? rawUrl;
        imageSlots[i] = url;
        const partial = imageSlots.filter(Boolean) as string[];
        updateNovelJob(jobId, "generating_images", partial);
        void updateNovelJobInSupabase(jobId, "generating_images", partial);
        return url;
      });

      await runCapped(tasks, 3);

      const validImages = imageSlots.filter(Boolean) as string[];
      if (validImages.length === 0) throw new Error("Tidak ada gambar yang berhasil dibuat");

      // Keep only timepoints whose image succeeded
      const validTimepoints = timepointsRaw.filter((_, i) => imageSlots[i] !== null);

      // Transition to awaiting_approval — store images + timepoints, no video yet
      const timepointsJson = JSON.stringify(validTimepoints);
      updateNovelJob(jobId, "awaiting_approval", validImages, timepointsJson);
      void updateNovelJobInSupabase(jobId, "awaiting_approval", validImages, null, null, timepointsJson);
    } catch (err: any) {
      console.error(`[Novel] generate ${jobId} failed:`, err);
      updateNovelJob(jobId, "failed", undefined, undefined, undefined, err.message ?? "Generasi gambar gagal");
      void updateNovelJobInSupabase(jobId, "failed", undefined, undefined, err.message);
      await addCreditsAsync(phone, NOVEL_CREDITS, "refund").catch(() => {});
    }
  })();

  return res.status(202).json({ jobId, creditsRemaining: getCredits(phone) });
});

// ── POST /assemble/:jobId — Phase 2: user approved, assemble video ────────────

router.post("/assemble/:jobId", async (req, res) => {
  const phone = req.user!.phone;
  const job = getNovelJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job tidak ditemukan" });
  if (job.phone !== phone) return res.status(403).json({ error: "Akses ditolak" });
  if (job.status !== "awaiting_approval") {
    return res.status(400).json({ error: "Storyboard belum siap untuk diassemble" });
  }

  const musicJob = getMusicJob(job.music_job_id);
  if (!musicJob?.audio_url) return res.status(400).json({ error: "Audio tidak ditemukan" });

  updateNovelJob(job.id, "assembling");
  void updateNovelJobInSupabase(job.id, "assembling");
  res.status(202).json({ ok: true });

  (async () => {
    try {
      const imageUrls: string[] = JSON.parse(job.image_urls_json ?? "[]");
      const timepointsRaw: MusicTimepoint[] = JSON.parse(job.timepoints_json ?? "[]");
      const fullTimepoints: Timepoint[] = timepointsRaw.length > 0
        ? timepointsRaw.map(tp => mapToTimepoint(tp))
        : imageUrls.map((_, i) => mapToTimepoint({
            timestamp: `${Math.floor(i * 20 / 60)}:${String((i * 20) % 60).padStart(2, "0")}`,
            label: `Scene ${i + 1}`,
            description: "cinematic scene",
            mood: "dreamy",
          }));

      const videoPath = await assembleVideo({
        frameUrls: imageUrls,
        musicUrl: musicJob.audio_url!,
        timepoints: fullTimepoints,
      });

      updateNovelJob(job.id, "uploading", imageUrls);
      void updateNovelJobInSupabase(job.id, "uploading", imageUrls);

      const tmpDir = path.dirname(videoPath);
      let videoUrl: string | null = null;
      try {
        const buf = await readFile(videoPath);
        videoUrl = await uploadToGcs(buf, "video/mp4", "novels/videos", phone);
      } finally {
        await cleanupTmpDir(tmpDir);
      }

      if (!videoUrl) throw new Error("Gagal upload video ke GCS");

      updateNovelJob(job.id, "completed", imageUrls, undefined, videoUrl);
      void updateNovelJobInSupabase(job.id, "completed", imageUrls, videoUrl, null, job.timepoints_json);
    } catch (err: any) {
      console.error(`[Novel] assemble ${job.id} failed:`, err);
      updateNovelJob(job.id, "failed", undefined, undefined, undefined, err.message ?? "Assembly video gagal");
      void updateNovelJobInSupabase(job.id, "failed", undefined, undefined, err.message);
      await addCreditsAsync(phone, NOVEL_CREDITS, "refund").catch(() => {});
    }
  })();
});

// ── GET /status/:jobId ────────────────────────────────────────────────────────

router.get("/status/:jobId", (req, res) => {
  const phone = req.user!.phone;
  const job = getNovelJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job tidak ditemukan" });
  if (job.phone !== phone) return res.status(403).json({ error: "Akses ditolak" });

  const imageUrls: string[] = job.image_urls_json ? JSON.parse(job.image_urls_json) : [];
  return res.json({
    status: job.status,
    imageUrls,
    videoUrl: job.status === "completed" ? job.video_url : null,
    error: job.error ?? null,
  });
});

export default router;
