import { Router } from "express";
import { nanoid } from "nanoid";
import {
  getOrCreateUserAsync, deductCreditsAsync, getCredits,
  createMusicJob, getMusicJob, updateMusicJob, addCreditsAsync,
  getMusicJobsByPhone, renameMusicJob, getNovelSummariesForPhone,
} from "../lib/db.js";
import { generateMusic } from "../lib/lyria.js";
import { generateEnhancedPromptWithTimepoints } from "../lib/anthropic.js";
import { logCost, calculateLyriaCost, calculateClaudeCost } from "../lib/cost-logger.js";
import { generationRateLimit } from "../middleware/rateLimit.js";
import { createMusicJobInSupabase, updateMusicJobInSupabase } from "../lib/supabase.js";

const router = Router();
const MUSIC_CREDITS = 10;

router.post("/enhance-prompt", async (req, res) => {
  const { prompt, genres } = req.body as { prompt?: string; genres?: string[] };
  if (!prompt?.trim() && (!genres || genres.length === 0)) {
    return res.status(400).json({ error: "Prompt atau genre wajib diisi" });
  }
  try {
    const { enhancedPrompt, lyrics, timepoints, inputTokens, outputTokens } = await generateEnhancedPromptWithTimepoints({
      genres: genres ?? [],
      userDescription: prompt?.trim() ?? "",
    });
    logCost({
      phone: req.user!.phone,
      service: "claude",
      operation: "enhancePromptWithTimepoints",
      costUsd: calculateClaudeCost("claude-sonnet-4-6", inputTokens, outputTokens),
      inputTokens,
      outputTokens,
    });
    return res.json({ enhancedPrompt, lyrics, timepoints });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Gagal enhance prompt" });
  }
});

router.patch("/rename/:jobId", async (req, res) => {
  const phone = req.user!.phone;
  const { title } = req.body as { title?: string };
  if (!title?.trim()) return res.status(400).json({ error: "Judul wajib diisi" });
  const updated = renameMusicJob(req.params.jobId, phone, title.trim().slice(0, 100));
  if (!updated) return res.status(404).json({ error: "Job tidak ditemukan" });
  return res.json({ ok: true });
});

router.post("/generate", generationRateLimit, async (req, res) => {
  const phone = req.user!.phone;
  const { prompt, genres, title: clientTitle, enhancedPrompt: clientEnhancedPrompt, timepoints: clientTimepoints, lyrics: clientLyrics } = req.body as {
    prompt?: string; genres?: string[]; title?: string; enhancedPrompt?: string; timepoints?: unknown[]; lyrics?: string;
  };

  if (!prompt?.trim() && (!genres || genres.length === 0)) {
    return res.status(400).json({ error: "Prompt atau genre musik wajib diisi" });
  }
  if (prompt && prompt.length > 500) {
    return res.status(400).json({ error: "Prompt terlalu panjang (maksimal 500 karakter)" });
  }

  const user = await getOrCreateUserAsync(phone);
  if (user.credits < MUSIC_CREDITS) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: user.credits });
  }

  const deducted = await deductCreditsAsync(phone, MUSIC_CREDITS);
  if (!deducted) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: getCredits(phone) });
  }

  const jobId = nanoid();
  const rawPrompt = prompt?.trim() ?? "";
  const timepointsJson = clientTimepoints && clientTimepoints.length > 0 ? JSON.stringify(clientTimepoints) : undefined;
  const title = clientTitle?.trim().slice(0, 100) || undefined;
  createMusicJob(jobId, phone, rawPrompt || (genres ?? []).join(", "), title, clientEnhancedPrompt, timepointsJson, clientLyrics);
  void createMusicJobInSupabase({ id: jobId, phone, prompt: rawPrompt || (genres ?? []).join(", "), enhanced_prompt: clientEnhancedPrompt });

  (async () => {
    try {
      updateMusicJob(jobId, "generating");
      void updateMusicJobInSupabase(jobId, "generating");

      let enhancedPrompt = clientEnhancedPrompt;
      let lyrics = clientLyrics;
      if (!enhancedPrompt) {
        const result = await generateEnhancedPromptWithTimepoints({ genres: genres ?? [], userDescription: rawPrompt });
        enhancedPrompt = result.enhancedPrompt;
        lyrics = lyrics ?? result.lyrics;
        logCost({
          phone,
          service: "claude",
          operation: "enhanceMusicPrompt",
          costUsd: calculateClaudeCost("claude-sonnet-4-6", result.inputTokens, result.outputTokens),
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        });
      }

      const audioUrl = await generateMusic(enhancedPrompt);
      logCost({ phone, service: "wavespeed", operation: "generateMusic", costUsd: calculateLyriaCost() });
      updateMusicJob(jobId, "completed", audioUrl, undefined, enhancedPrompt, undefined, lyrics);
      void updateMusicJobInSupabase(jobId, "completed", audioUrl, null, enhancedPrompt, lyrics);
    } catch (err: any) {
      console.error(`[Music] Job ${jobId} failed:`, err);
      updateMusicJob(jobId, "failed", undefined, err.message ?? "Generasi musik gagal");
      void updateMusicJobInSupabase(jobId, "failed", null, err.message ?? "Generasi musik gagal");
      await addCreditsAsync(phone, MUSIC_CREDITS, "refund").catch(() => {});
    }
  })();

  return res.status(202).json({
    jobId,
    creditsRemaining: getCredits(phone),
  });
});

router.get("/status/:jobId", async (req, res) => {
  const phone = req.user!.phone;
  const job = getMusicJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job tidak ditemukan" });
  if (job.phone !== phone) return res.status(403).json({ error: "Akses ditolak" });

  return res.json({
    status: job.status,
    audioUrl: job.audio_url,
    error: job.error,
  });
});

router.get("/history", (req, res) => {
  const phone = req.user!.phone;
  const jobs = getMusicJobsByPhone(phone);
  const novelMap = getNovelSummariesForPhone(phone);
  const jobsWithNovel = jobs.map(j => ({
    ...j,
    novel: novelMap[j.id] ?? null,
  }));
  return res.json({ jobs: jobsWithNovel });
});

export default router;
