import { Router } from "express";
import { nanoid } from "nanoid";
import {
  getOrCreateUserAsync, deductCreditsAsync, getCredits,
  createMusicJob, getMusicJob, updateMusicJob, addCreditsAsync,
  getMusicJobsByPhone,
} from "../lib/db.js";
import { generateMusic } from "../lib/lyria.js";
import { enhanceMusicPrompt, generateEnhancedPromptWithTimepoints } from "../lib/anthropic.js";
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
    const { enhancedPrompt, timepoints, inputTokens, outputTokens } = await generateEnhancedPromptWithTimepoints({
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
    return res.json({ enhancedPrompt, timepoints });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Gagal enhance prompt" });
  }
});

router.post("/generate", generationRateLimit, async (req, res) => {
  const phone = req.user!.phone;
  const { prompt, genres, enhancedPrompt: clientEnhancedPrompt } = req.body as {
    prompt?: string; genres?: string[]; enhancedPrompt?: string;
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
  createMusicJob(jobId, phone, rawPrompt || (genres ?? []).join(", "), clientEnhancedPrompt);
  void createMusicJobInSupabase({ id: jobId, phone, prompt: rawPrompt || (genres ?? []).join(", "), enhanced_prompt: clientEnhancedPrompt });

  (async () => {
    try {
      updateMusicJob(jobId, "generating");
      void updateMusicJobInSupabase(jobId, "generating");

      let enhancedPrompt = clientEnhancedPrompt;
      if (!enhancedPrompt) {
        const result = await enhanceMusicPrompt({ genres: genres ?? [], userDescription: rawPrompt });
        enhancedPrompt = result.enhancedPrompt;
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
      updateMusicJob(jobId, "completed", audioUrl, undefined, enhancedPrompt);
      void updateMusicJobInSupabase(jobId, "completed", audioUrl, null, enhancedPrompt);
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
  return res.json({ jobs });
});

export default router;
