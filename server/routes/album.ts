import { Router } from "express";
import { nanoid } from "nanoid";
import {
  getOrCreateUserAsync, deductCreditsAsync, getCredits,
  createMusicJob, getMusicJob, updateMusicJob, addCreditsAsync,
  createAlbum, getAlbum, updateAlbumStatus, updateAlbumJobIds, updateAlbumCoverUrl, renameAlbum, getAlbumsByPhoneAsync,
} from "../lib/db.js";
import { generateMusic } from "../lib/lyria.js";
import { generateEnhancedPromptWithTimepoints, generateAlbumSongConcepts, type AlbumSongConcept } from "../lib/anthropic.js";
import { logCost, calculateLyriaCost, calculateClaudeCost, calculateWaveSpeedImageCost } from "../lib/cost-logger.js";
import { createMusicJobInSupabase, updateMusicJobInSupabase, createAlbumInSupabase, updateAlbumInSupabase } from "../lib/supabase.js";
import { generateAlbumCover } from "../lib/wavespeed-nano.js";

const router = Router();

const ALBUM_PRICING: Record<number, number> = { 5: 150, 10: 250 };
const VALID_COUNTS = [5, 10];

async function generateOneSong(concept: AlbumSongConcept, phone: string): Promise<string> {
  const jobId = nanoid();
  createMusicJob(jobId, phone, concept.description, concept.title);
  void createMusicJobInSupabase({ id: jobId, phone, prompt: concept.description, enhanced_prompt: undefined });

  updateMusicJob(jobId, "generating");
  void updateMusicJobInSupabase(jobId, "generating");

  (async () => {
    try {
      const result = await generateEnhancedPromptWithTimepoints({
        genres: [concept.genre],
        userDescription: concept.description,
      });
      logCost({
        phone,
        service: "claude",
        operation: "enhanceMusicPromptForAlbum",
        costUsd: calculateClaudeCost("claude-sonnet-4-6", result.inputTokens, result.outputTokens),
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });

      const audioUrl = await generateMusic(result.enhancedPrompt);
      logCost({ phone, service: "wavespeed", operation: "generateMusicForAlbum", costUsd: calculateLyriaCost() });

      updateMusicJob(jobId, "completed", audioUrl, undefined, result.enhancedPrompt, JSON.stringify(result.timepoints), result.lyrics);
      void updateMusicJobInSupabase(jobId, "completed", audioUrl, null, result.enhancedPrompt, result.lyrics);
    } catch (err: any) {
      console.error(`[Album] Song job ${jobId} failed:`, err);
      updateMusicJob(jobId, "failed", undefined, err.message ?? "Generasi musik gagal");
      void updateMusicJobInSupabase(jobId, "failed", null, err.message ?? "Generasi musik gagal");
    }
  })();

  return jobId;
}

router.post("/generate", async (req, res) => {
  const phone = req.user!.phone;
  const { theme, songCount } = req.body as { theme?: string; songCount?: number };

  if (!theme?.trim()) {
    return res.status(400).json({ error: "Tema album wajib diisi" });
  }
  if (theme.length > 300) {
    return res.status(400).json({ error: "Tema terlalu panjang (maksimal 300 karakter)" });
  }
  if (!VALID_COUNTS.includes(songCount as number)) {
    return res.status(400).json({ error: "Jumlah lagu harus 5 atau 10" });
  }

  const creditsRequired = ALBUM_PRICING[songCount as number];
  const user = await getOrCreateUserAsync(phone);
  if (user.credits < creditsRequired) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: user.credits, required: creditsRequired });
  }

  const deducted = await deductCreditsAsync(phone, creditsRequired);
  if (!deducted) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: getCredits(phone), required: creditsRequired });
  }

  const albumId = nanoid();

  // Create album record immediately so polling works right away
  createAlbum({
    id: albumId,
    phone,
    theme: theme.trim(),
    songCount: songCount as number,
    creditsCharged: creditsRequired,
    musicJobIds: [],
  });
  void createAlbumInSupabase({ id: albumId, phone, theme: theme.trim(), songCount: songCount as number, creditsCharged: creditsRequired });

  (async () => {
    try {
      const { concepts, coverPrompt, inputTokens, outputTokens } = await generateAlbumSongConcepts(theme.trim(), songCount as number);
      logCost({
        phone,
        service: "claude",
        operation: "generateAlbumSongConcepts",
        costUsd: calculateClaudeCost("claude-sonnet-4-6", inputTokens, outputTokens),
        inputTokens,
        outputTokens,
      });

      // Songs + cover art generated in parallel
      const [jobIds] = await Promise.all([
        Promise.all(concepts.map(c => generateOneSong(c, phone))),
        generateAlbumCover(coverPrompt)
          .then(coverUrl => {
            updateAlbumCoverUrl(albumId, coverUrl);
            void updateAlbumInSupabase(albumId, { coverUrl });
            logCost({ phone, service: "wavespeed", operation: "generateAlbumCover", costUsd: calculateWaveSpeedImageCost() });
          })
          .catch(err => console.error(`[Album] Cover generation failed for ${albumId}:`, err)),
      ]);

      updateAlbumJobIds(albumId, jobIds);
      void updateAlbumInSupabase(albumId, { musicJobIds: jobIds });
    } catch (err: any) {
      console.error(`[Album] Album ${albumId} setup failed:`, err);
      updateAlbumStatus(albumId, "failed");
      void updateAlbumInSupabase(albumId, { status: "failed" });
      await addCreditsAsync(phone, creditsRequired, "refund").catch(() => {});
    }
  })();

  return res.status(202).json({ albumId, creditsRemaining: getCredits(phone) });
});

router.patch("/rename/:albumId", async (req, res) => {
  const phone = req.user!.phone;
  const { title } = req.body as { title?: string };
  if (!title?.trim()) return res.status(400).json({ error: "Judul wajib diisi" });
  const trimmed = title.trim().slice(0, 120);
  const updated = renameAlbum(req.params.albumId, phone, trimmed);
  if (!updated) return res.status(404).json({ error: "Album tidak ditemukan" });
  void updateAlbumInSupabase(req.params.albumId, { title: trimmed });
  return res.json({ ok: true });
});

router.get("/status/:albumId", (req, res) => {
  const phone = req.user!.phone;
  const album = getAlbum(req.params.albumId);
  if (!album) return res.status(404).json({ error: "Album tidak ditemukan" });
  if (album.phone !== phone) return res.status(403).json({ error: "Akses ditolak" });

  const jobIds: string[] = JSON.parse(album.music_job_ids);

  const base = { albumId: album.id, title: album.title, theme: album.theme, songCount: album.song_count, coverUrl: album.cover_url };

  if (album.status === "failed") {
    return res.json({ ...base, status: "failed", songs: [] });
  }

  // Still preparing concepts — no songs yet
  if (jobIds.length === 0) {
    return res.json({ ...base, status: "generating", songs: [] });
  }

  const songs = jobIds.map(id => {
    const job = getMusicJob(id);
    return job
      ? { id: job.id, title: job.title, status: job.status, audioUrl: job.audio_url, error: job.error }
      : { id, title: null, status: "pending", audioUrl: null, error: null };
  });

  const allDone = songs.length > 0 && songs.every(s => s.status === "completed" || s.status === "failed");
  const anyCompleted = songs.some(s => s.status === "completed");
  const overallStatus = allDone ? (anyCompleted ? "completed" : "failed") : "generating";

  if (allDone && album.status === "generating") {
    updateAlbumStatus(album.id, overallStatus);
    void updateAlbumInSupabase(album.id, { status: overallStatus });
  }

  return res.json({ ...base, status: overallStatus, songs });
});

router.get("/list", async (req, res) => {
  const phone = req.user!.phone;
  const albums = await getAlbumsByPhoneAsync(phone);
  const result = albums.map(a => {
    const jobIds: string[] = JSON.parse(a.music_job_ids);
    const albumBase = { id: a.id, title: a.title, theme: a.theme, songCount: a.song_count, creditsCharged: a.credits_charged, coverUrl: a.cover_url, createdAt: a.created_at };
    if (a.status === "failed" || jobIds.length === 0) {
      return { ...albumBase, status: a.status, songs: [] };
    }
    const songs = jobIds.map(id => {
      const job = getMusicJob(id);
      return { id, title: job?.title ?? null, status: job?.status ?? "pending", audioUrl: job?.audio_url ?? null };
    });
    const allDone = songs.length > 0 && songs.every(s => s.status === "completed" || s.status === "failed");
    const status = allDone ? (songs.some(s => s.status === "completed") ? "completed" : "failed") : "generating";
    return { ...albumBase, status, songs };
  });
  return res.json({ albums: result });
});

export default router;
