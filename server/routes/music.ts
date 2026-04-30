import { Router } from "express";
import { nanoid } from "nanoid";
import {
  getOrCreateUserAsync, deductCreditsAsync, getCredits,
  createMusicJob, getMusicJob, updateMusicJob, addCreditsAsync,
} from "../lib/db.js";
import { generateMusic } from "../lib/lyria.js";
import { generationRateLimit } from "../middleware/rateLimit.js";

const router = Router();
const MUSIC_CREDITS = 10;

router.post("/generate", generationRateLimit, async (req, res) => {
  const phone = req.user!.phone;
  const { prompt } = req.body as { prompt?: string };

  if (!prompt?.trim()) {
    return res.status(400).json({ error: "Prompt musik wajib diisi" });
  }
  if (prompt.length > 500) {
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
  createMusicJob(jobId, phone, prompt.trim());

  // Async generation — don't block the response
  (async () => {
    try {
      updateMusicJob(jobId, "generating");
      const audioUrl = await generateMusic(prompt.trim());
      updateMusicJob(jobId, "completed", audioUrl);
    } catch (err: any) {
      console.error(`[Music] Job ${jobId} failed:`, err);
      updateMusicJob(jobId, "failed", undefined, err.message ?? "Generasi musik gagal");
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

export default router;
