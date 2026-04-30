import { Router } from "express";
import { nanoid } from "nanoid";
import path from "path";
import { readFile } from "fs/promises";
import { Readable } from "stream";
import {
  getMusicJob, createNovelJob, getNovelJob, updateNovelJob,
  getOrCreateUserAsync, deductCreditsAsync, getCredits, addCreditsAsync,
} from "../lib/db.js";
import { verifyToken } from "../lib/otp.js";
import { generateStoryboardImagePrompts, generateEnhancedPromptWithTimepoints, generateSongUnderstanding } from "../lib/anthropic.js";
import { generateNanoBananaImage, generateCharacterPortrait } from "../lib/wavespeed-nano.js";
import { uploadToGcs } from "../lib/gcs.js";
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
  createNovelJobInSupabase({ id: jobId, musicJobId, phone }).catch(e => console.error("[Novel] Supabase create failed:", e));

  const storedTimepointsJson = musicJob.timepoints_json;
  const enhancedPrompt = musicJob.enhanced_prompt ?? musicJob.prompt;
  const songTitle = musicJob.title ?? null;
  const songDescription = musicJob.prompt;
  const songLyrics = musicJob.lyrics ?? null;

  (async () => {
    try {
      updateNovelJob(jobId, "generating_images");
      updateNovelJobInSupabase(jobId, "generating_images").catch(e => console.error("[Novel] Supabase sync failed:", e));

      // Resolve timepoints from stored JSON or generate fresh — run in parallel with song understanding
      const timepointsPromise: Promise<MusicTimepoint[]> = (async () => {
        if (storedTimepointsJson) {
          try {
            const parsed = JSON.parse(storedTimepointsJson) as MusicTimepoint[];
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          } catch { /* fall through */ }
        }
        const { timepoints, inputTokens, outputTokens } = await generateEnhancedPromptWithTimepoints({
          genres: [],
          userDescription: songDescription,
        });
        logCost({
          phone, service: "claude", operation: "generateTimepointsForNovel",
          costUsd: calculateClaudeCost("claude-sonnet-4-6", inputTokens, outputTokens),
          inputTokens, outputTokens,
        });
        return timepoints;
      })();

      // Seed song understanding in parallel with timepoint resolution (Haiku = fast)
      const understandingPromise = generateSongUnderstanding({
        songTitle, songDescription, enhancedMusicPrompt: enhancedPrompt,
        timepoints: storedTimepointsJson ? (JSON.parse(storedTimepointsJson) as MusicTimepoint[]).slice(0, 3) : [],
        lyrics: songLyrics,
      }).catch((e) => { console.error("[Novel] Song understanding failed, continuing:", e); return null; });

      const [timepointsRaw, songUnderstanding] = await Promise.all([timepointsPromise, understandingPromise]);

      logCost({ phone, service: "claude", operation: "generateSongUnderstanding", costUsd: calculateClaudeCost("claude-haiku-4-5-20251001", 400, 120) });

      // Limit to 3 images: first, middle, last — keeps cost low while covering the full arc
      const timepoints3 = timepointsRaw.length > 3
        ? [timepointsRaw[0], timepointsRaw[Math.floor(timepointsRaw.length / 2)], timepointsRaw[timepointsRaw.length - 1]]
        : timepointsRaw;

      // Character portrait: use song understanding's portrait prompt, or fall back to user-uploaded image
      const charImagePromise: Promise<string> = characterImageBase64
        ? Promise.resolve(`data:image/jpeg;base64,${characterImageBase64}`)
        : generateCharacterPortrait(
            songUnderstanding?.characterPortraitPrompt ||
            `photorealistic portrait of an attractive young Indonesian woman, 20s, striking features, expressive eyes, soft cinematic lighting, shallow depth of field, beautiful, editorial quality, 8k`
          );

      const storyboardPromise = generateStoryboardImagePrompts({
        songTitle, songDescription, enhancedMusicPrompt: enhancedPrompt,
        timepoints: timepoints3, genres: [], lyrics: songLyrics, songUnderstanding,
      });

      const [charImageUrl, { prompts, inputTokens: pIn, outputTokens: pOut }] = await Promise.all([
        charImagePromise,
        storyboardPromise,
      ]);

      logCost({
        phone, service: "claude", operation: "generateStoryboardPrompts",
        costUsd: calculateClaudeCost("claude-sonnet-4-6", pIn, pOut),
        inputTokens: pIn, outputTokens: pOut,
      });

      // Generate images with 3-way concurrency; push partial updates as each arrives
      const imageSlots: Array<string | null> = new Array(timepoints3.length).fill(null);
      const tasks = timepoints3.map((tp, i) => async () => {
        const fullPrompt = prompts[i] ?? "cinematic scene, atmospheric lighting, photorealistic, beautiful, 8k";
        console.log(`[Novel] image task ${i} prompt: ${fullPrompt.slice(0, 120)}`);
        // Retry with a safe fallback if Seedream rejects the detailed prompt
        const rawUrl = await generateNanoBananaImage(fullPrompt, charImageUrl).catch(async (err) => {
          console.warn(`[Novel] image task ${i} rejected, retrying with fallback prompt. Error: ${err.message}`);
          const fallback = `${tp.mood} cinematic scene, ${tp.description.split(",")[0].slice(0, 60)}, atmospheric lighting, photorealistic, 8k`;
          return generateNanoBananaImage(fallback, charImageUrl);
        });
        imageSlots[i] = rawUrl;
        const partial = imageSlots.filter(Boolean) as string[];
        updateNovelJob(jobId, "generating_images", partial);
        updateNovelJobInSupabase(jobId, "generating_images", partial).catch(e => console.error("[Novel] Supabase sync failed:", e));
        return rawUrl;
      });

      await runCapped(tasks, 3);

      const validImages = imageSlots.filter(Boolean) as string[];
      if (validImages.length === 0) throw new Error("Tidak ada gambar yang berhasil dibuat");

      // Keep only timepoints whose image succeeded
      const validTimepoints = timepoints3.filter((_, i) => imageSlots[i] !== null);

      // Transition to awaiting_approval — store images + timepoints, no video yet
      const timepointsJson = JSON.stringify(validTimepoints);
      updateNovelJob(jobId, "awaiting_approval", validImages, timepointsJson);
      updateNovelJobInSupabase(jobId, "awaiting_approval", validImages, null, null, timepointsJson).catch(e => console.error("[Novel] Supabase sync failed:", e));
    } catch (err: any) {
      console.error(`[Novel] generate ${jobId} failed:`, err);
      updateNovelJob(jobId, "failed", undefined, undefined, undefined, err.message ?? "Generasi gambar gagal");
      updateNovelJobInSupabase(jobId, "failed", undefined, undefined, err.message).catch(e => console.error("[Novel] Supabase sync failed:", e));
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
  updateNovelJobInSupabase(job.id, "assembling").catch(e => console.error("[Novel] Supabase sync failed:", e));
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
      updateNovelJobInSupabase(job.id, "uploading", imageUrls).catch(e => console.error("[Novel] Supabase sync failed:", e));

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
      updateNovelJobInSupabase(job.id, "completed", imageUrls, videoUrl, null, job.timepoints_json).catch(e => console.error("[Novel] Supabase sync failed:", e));
    } catch (err: any) {
      console.error(`[Novel] assemble ${job.id} failed:`, err);
      updateNovelJob(job.id, "failed", undefined, undefined, undefined, err.message ?? "Assembly video gagal");
      updateNovelJobInSupabase(job.id, "failed", undefined, undefined, err.message).catch(e => console.error("[Novel] Supabase sync failed:", e));
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
  const timepoints = job.timepoints_json ? JSON.parse(job.timepoints_json) as Array<{ timestamp: string; label: string; description: string; mood: string }> : [];
  return res.json({
    status: job.status,
    imageUrls,
    timepoints,
    videoUrl: job.status === "completed" ? job.video_url : null,
    error: job.error ?? null,
  });
});

// ── POST /regenerate-image/:jobId/:index — regenerate a single storyboard frame ─

router.post("/regenerate-image/:jobId/:index", async (req, res) => {
  const phone = req.user!.phone;
  const job = getNovelJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job tidak ditemukan" });
  if (job.phone !== phone) return res.status(403).json({ error: "Akses ditolak" });
  if (job.status !== "awaiting_approval") return res.status(400).json({ error: "Hanya bisa di fase review" });

  const idx = parseInt(req.params.index, 10);
  const imageUrls: string[] = job.image_urls_json ? JSON.parse(job.image_urls_json) : [];
  const timepoints: Array<{ timestamp: string; label: string; description: string; mood: string }> =
    job.timepoints_json ? JSON.parse(job.timepoints_json) : [];

  if (isNaN(idx) || idx < 0 || idx >= imageUrls.length) {
    return res.status(400).json({ error: "Index tidak valid" });
  }

  const musicJob = getMusicJob(job.music_job_id);
  if (!musicJob) return res.status(400).json({ error: "Music job tidak ditemukan" });

  res.status(202).json({ ok: true });

  (async () => {
    try {
      const songTitle = musicJob.title ?? null;
      const songDescription = musicJob.prompt;
      const enhancedPrompt = musicJob.enhanced_prompt ?? musicJob.prompt;
      const songLyricsRegen = musicJob.lyrics ?? null;
      const tp = timepoints[idx];
      if (!tp) throw new Error("Timepoint tidak ditemukan");

      const songUnderstanding = await generateSongUnderstanding({
        songTitle, songDescription, enhancedMusicPrompt: enhancedPrompt,
        timepoints: [tp], lyrics: songLyricsRegen,
      }).catch(() => null);

      const [{ prompts }, charImageUrl] = await Promise.all([
        generateStoryboardImagePrompts({
          songTitle, songDescription, enhancedMusicPrompt: enhancedPrompt,
          timepoints: [tp], genres: [], lyrics: songLyricsRegen, songUnderstanding,
        }),
        generateCharacterPortrait(
          songUnderstanding?.characterPortraitPrompt ||
          `photorealistic portrait of an attractive young Indonesian woman, 20s, striking features, expressive eyes, soft cinematic lighting, shallow depth of field, beautiful, editorial quality, 8k`
        ),
      ]);

      const newUrl = await generateNanoBananaImage(
        prompts[0] ?? "cinematic landscape, beautiful, photorealistic, atmospheric lighting",
        charImageUrl,
      );

      imageUrls[idx] = newUrl;
      updateNovelJob(job.id, "awaiting_approval", imageUrls);
      updateNovelJobInSupabase(job.id, "awaiting_approval", imageUrls, null, null, job.timepoints_json)
        .catch(e => console.error("[Novel] Supabase sync failed:", e));
    } catch (err: any) {
      console.error(`[Novel] regenerate-image ${job.id}[${idx}] failed:`, err);
    }
  })();
});

export default router;

// ── GET /api/novel/video/:jobId?t=TOKEN ──────────────────────────────────────
// Registered WITHOUT requireAuth in index.ts — handles its own token check via ?t=
import type { Request, Response } from "express";

export async function novelVideoProxy(req: Request, res: Response): Promise<void> {
  const rawToken = typeof req.query.t === "string" ? req.query.t
    : req.headers.authorization?.replace("Bearer ", "");
  if (!rawToken) { res.status(401).end(); return; }
  const decoded = verifyToken(rawToken);
  if (!decoded) { res.status(401).end(); return; }

  const job = getNovelJob(req.params.jobId);
  if (!job || job.phone !== decoded.phone) { res.status(404).end(); return; }
  if (!job.video_url) { res.status(404).end(); return; }

  const fetchHeaders: Record<string, string> = {};
  if (req.headers.range) fetchHeaders["Range"] = req.headers.range;

  try {
    const gcsRes = await fetch(job.video_url, { headers: fetchHeaders });
    res.status(gcsRes.status);
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = gcsRes.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    if (!gcsRes.body) { res.end(); return; }
    Readable.fromWeb(gcsRes.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  } catch {
    if (!res.headersSent) res.status(502).end();
  }
}
