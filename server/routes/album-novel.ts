import { Router } from "express";
import { nanoid } from "nanoid";
import path from "path";
import { readFile } from "fs/promises";
import {
  getMusicJob, getAlbum, getOrCreateUserAsync, deductCreditsAsync, getCredits, addCreditsAsync,
  createAlbumNovelJob, getAlbumNovelJob, updateAlbumNovelJob,
} from "../lib/db.js";
import { generateSongUnderstanding, generateStoryboardImagePrompts, generateEnhancedPromptWithTimepoints } from "../lib/anthropic.js";
import { generateNanoBananaImage, generateCharacterPortrait } from "../lib/wavespeed-nano.js";
import { assembleVideo, concatenateVideos, cleanupTmpDir } from "../lib/ffmpeg.js";
import { uploadToGcs } from "../lib/gcs.js";
import { logCost, calculateClaudeCost } from "../lib/cost-logger.js";
import type { Timepoint } from "../lib/db.js";

const router = Router();
const ALBUM_NOVEL_CREDITS_PER_SONG = 50;

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
        console.error(`[AlbumNovel] song task ${idx} failed:`, err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function getFreshTimepoints(phone: string, description: string): Promise<MusicTimepoint[]> {
  const { timepoints, inputTokens, outputTokens } = await generateEnhancedPromptWithTimepoints({
    genres: [], userDescription: description,
  });
  logCost({
    phone, service: "claude", operation: "generateTimepointsForAlbumNovel",
    costUsd: calculateClaudeCost("claude-sonnet-4-6", inputTokens, outputTokens),
    inputTokens, outputTokens,
  });
  return timepoints as MusicTimepoint[];
}

type MusicJob = NonNullable<ReturnType<typeof getMusicJob>>;

async function buildSongVideo(musicJob: MusicJob, phone: string): Promise<string> {
  const storedTimepointsJson = musicJob.timepoints_json;
  const enhancedPrompt = musicJob.enhanced_prompt ?? musicJob.prompt;
  const songTitle = musicJob.title ?? null;
  const songDescription = musicJob.prompt;
  const songLyrics = musicJob.lyrics ?? null;

  // Resolve timepoints — use stored ones or generate fresh
  let timepointsRaw: MusicTimepoint[];
  if (storedTimepointsJson) {
    try {
      const parsed = JSON.parse(storedTimepointsJson) as MusicTimepoint[];
      timepointsRaw = Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : await getFreshTimepoints(phone, songDescription);
    } catch {
      timepointsRaw = await getFreshTimepoints(phone, songDescription);
    }
  } else {
    timepointsRaw = await getFreshTimepoints(phone, songDescription);
  }

  // Limit to 3: first, middle, last
  const timepoints3 = timepointsRaw.length > 3
    ? [timepointsRaw[0], timepointsRaw[Math.floor(timepointsRaw.length / 2)], timepointsRaw[timepointsRaw.length - 1]]
    : timepointsRaw;

  const songUnderstanding = await generateSongUnderstanding({
    songTitle, songDescription, enhancedMusicPrompt: enhancedPrompt,
    timepoints: timepoints3.slice(0, 3), lyrics: songLyrics,
  }).catch((e) => { console.error("[AlbumNovel] song understanding failed:", e); return null; });

  logCost({ phone, service: "claude", operation: "generateSongUnderstandingForAlbumNovel", costUsd: calculateClaudeCost("claude-haiku-4-5-20251001", 400, 120) });

  const [charImageUrl, { prompts, inputTokens: pIn, outputTokens: pOut }] = await Promise.all([
    generateCharacterPortrait(
      songUnderstanding?.characterPortraitPrompt ||
      `photorealistic portrait of an attractive young Indonesian woman, 20s, striking features, expressive eyes, soft cinematic lighting, shallow depth of field, beautiful, editorial quality, 8k`
    ),
    generateStoryboardImagePrompts({
      songTitle, songDescription, enhancedMusicPrompt: enhancedPrompt,
      timepoints: timepoints3, genres: [], lyrics: songLyrics, songUnderstanding,
    }),
  ]);

  logCost({
    phone, service: "claude", operation: "generateStoryboardPromptsForAlbumNovel",
    costUsd: calculateClaudeCost("claude-sonnet-4-6", pIn, pOut),
    inputTokens: pIn, outputTokens: pOut,
  });

  // Generate images in parallel (up to 3)
  const imageUrls = await Promise.all(
    timepoints3.map(async (tp, i) => {
      const fullPrompt = prompts[i] ?? "cinematic scene, atmospheric lighting, photorealistic, beautiful, 8k";
      return generateNanoBananaImage(fullPrompt, charImageUrl).catch(async (err) => {
        console.warn(`[AlbumNovel] image ${i} rejected, retrying. Error: ${err.message}`);
        const fallback = `${tp.mood} cinematic scene, atmospheric lighting, photorealistic, 8k`;
        return generateNanoBananaImage(fallback, charImageUrl);
      });
    })
  );

  const fullTimepoints = timepoints3.map(tp => mapToTimepoint(tp));
  const videoPath = await assembleVideo({
    frameUrls: imageUrls,
    musicUrl: musicJob.audio_url!,
    timepoints: fullTimepoints,
  });

  const tmpDir = path.dirname(videoPath);
  try {
    const buf = await readFile(videoPath);
    const url = await uploadToGcs(buf, "video/mp4", "novels/album-videos", phone);
    if (!url) throw new Error("Upload video gagal");
    return url;
  } finally {
    await cleanupTmpDir(tmpDir);
  }
}

// ── Shared pipeline (used by both album and custom multi-song routes) ─────────

async function runNovelPipeline(novelJobId: string, songs: MusicJob[], phone: string, creditsRequired: number): Promise<void> {
  try {
    const videoUrls: (string | null)[] = new Array(songs.length).fill(null);

    const tasks = songs.map((musicJob, idx) => async () => {
      console.log(`[AlbumNovel] Processing song ${idx + 1}/${songs.length}: ${musicJob.id}`);
      const url = await buildSongVideo(musicJob, phone);
      videoUrls[idx] = url;
      const done = videoUrls.filter(Boolean).length;
      updateAlbumNovelJob(novelJobId, "generating", done);
      console.log(`[AlbumNovel] Song ${idx + 1} done (${done}/${songs.length})`);
      return url;
    });

    await runCapped(tasks, 3);

    const validUrls = videoUrls.filter((u): u is string => u !== null);
    if (validUrls.length === 0) throw new Error("Tidak ada video yang berhasil dibuat");

    updateAlbumNovelJob(novelJobId, "concatenating", validUrls.length);
    console.log(`[AlbumNovel] Concatenating ${validUrls.length} videos for job ${novelJobId}`);

    const concatPath = await concatenateVideos(validUrls);
    const concatDir = path.dirname(concatPath);

    let finalVideoUrl: string;
    try {
      const buf = await readFile(concatPath);
      const uploaded = await uploadToGcs(buf, "video/mp4", "novels/album-final", phone);
      if (!uploaded) throw new Error("Upload video final gagal");
      finalVideoUrl = uploaded;
    } finally {
      await cleanupTmpDir(concatDir);
    }

    updateAlbumNovelJob(novelJobId, "completed", validUrls.length, finalVideoUrl);
    console.log(`[AlbumNovel] Job ${novelJobId} completed: ${finalVideoUrl}`);
  } catch (err: any) {
    console.error(`[AlbumNovel] Job ${novelJobId} failed:`, err);
    updateAlbumNovelJob(novelJobId, "failed", undefined, undefined, err.message ?? "Gagal buat novel");
    await addCreditsAsync(phone, creditsRequired, "refund").catch(() => {});
  }
}

// ── POST /api/album-novel/generate — from album ───────────────────────────────

router.post("/generate", async (req, res) => {
  const phone = req.user!.phone;
  const { albumId } = req.body as { albumId?: string };
  if (!albumId) return res.status(400).json({ error: "albumId wajib diisi" });

  const album = getAlbum(albumId);
  if (!album) return res.status(404).json({ error: "Album tidak ditemukan" });
  if (album.phone !== phone) return res.status(403).json({ error: "Akses ditolak" });

  const jobIds: string[] = JSON.parse(album.music_job_ids);
  if (jobIds.length === 0) return res.status(400).json({ error: "Album belum punya lagu" });

  const songs = jobIds.map(id => getMusicJob(id)).filter((j): j is MusicJob => !!j);
  const incomplete = songs.filter(s => s.status !== "completed" || !s.audio_url);
  if (incomplete.length > 0) {
    return res.status(400).json({ error: "Semua lagu harus selesai dulu" });
  }

  const creditsRequired = ALBUM_NOVEL_CREDITS_PER_SONG * songs.length;
  const user = await getOrCreateUserAsync(phone);
  if (user.credits < creditsRequired) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: user.credits, required: creditsRequired });
  }

  const deducted = await deductCreditsAsync(phone, creditsRequired);
  if (!deducted) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: getCredits(phone), required: creditsRequired });
  }

  const novelJobId = nanoid();
  createAlbumNovelJob(novelJobId, albumId, phone, creditsRequired, songs.length);
  void runNovelPipeline(novelJobId, songs, phone, creditsRequired);

  return res.status(202).json({ novelJobId, creditsRemaining: getCredits(phone) });
});

// ── POST /api/album-novel/generate-from-songs — custom multi-song selection ──

router.post("/generate-from-songs", async (req, res) => {
  const phone = req.user!.phone;
  const { musicJobIds } = req.body as { musicJobIds?: string[] };

  if (!Array.isArray(musicJobIds) || musicJobIds.length < 2) {
    return res.status(400).json({ error: "Pilih minimal 2 lagu" });
  }
  if (musicJobIds.length > 20) {
    return res.status(400).json({ error: "Maksimal 20 lagu sekaligus" });
  }

  const songs = musicJobIds.map(id => getMusicJob(id)).filter((j): j is MusicJob => !!j);
  if (songs.some(s => s.phone !== phone)) return res.status(403).json({ error: "Akses ditolak" });

  const incomplete = songs.filter(s => s.status !== "completed" || !s.audio_url);
  if (incomplete.length > 0) {
    return res.status(400).json({ error: "Semua lagu harus selesai dulu" });
  }

  const creditsRequired = ALBUM_NOVEL_CREDITS_PER_SONG * songs.length;
  const user = await getOrCreateUserAsync(phone);
  if (user.credits < creditsRequired) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: user.credits, required: creditsRequired });
  }

  const deducted = await deductCreditsAsync(phone, creditsRequired);
  if (!deducted) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: getCredits(phone), required: creditsRequired });
  }

  const novelJobId = nanoid();
  createAlbumNovelJob(novelJobId, "multi", phone, creditsRequired, songs.length);
  void runNovelPipeline(novelJobId, songs, phone, creditsRequired);

  return res.status(202).json({ novelJobId, creditsRemaining: getCredits(phone) });
});

// ── GET /api/album-novel/status/:novelJobId ───────────────────────────────────

router.get("/status/:novelJobId", (req, res) => {
  const phone = req.user!.phone;
  const job = getAlbumNovelJob(req.params.novelJobId);
  if (!job) return res.status(404).json({ error: "Job tidak ditemukan" });
  if (job.phone !== phone) return res.status(403).json({ error: "Akses ditolak" });

  return res.json({
    status: job.status,
    songsDone: job.songs_done,
    songCount: job.song_count,
    finalVideoUrl: job.status === "completed" ? job.final_video_url : null,
    error: job.error ?? null,
  });
});

export default router;
