import { Router } from "express";
import { nanoid } from "nanoid";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import {
  getOrCreateUserAsync, deductCreditsAsync, getCredits,
  createMusicJob, getMusicJob, updateMusicJob, addCreditsAsync,
  getMusicJobsByPhone, renameMusicJob, getNovelSummariesForPhone, getAlbumMapForPhone,
} from "../lib/db.js";
import { generateMusic } from "../lib/lyria.js";
import { generateFromMelody } from "../lib/levodance.js";
import { generateEnhancedPromptWithTimepoints } from "../lib/anthropic.js";
import { logCost, calculateLyriaCost, calculateClaudeCost } from "../lib/cost-logger.js";
import { generationRateLimit } from "../middleware/rateLimit.js";
import { createMusicJobInSupabase, updateMusicJobInSupabase } from "../lib/supabase.js";
import { Storage } from "@google-cloud/storage";

const router = Router();
const MUSIC_CREDITS = 1;

// ── Multer: in-memory storage for audio recordings (max 5 MB) ────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── GCS client for recording uploads ─────────────────────────────────────────
const _gcsBucketName = process.env.GCS_BUCKET_NAME ?? "";
const _gcsStorage = _gcsBucketName ? new Storage() : null;

// ── Occasion prompts (same as frontend OCCASIONS) ─────────────────────────────
const OCCASION_PROMPTS: Record<string, string> = {
  birthday:    "Upbeat birthday song with warm celebratory feeling, joyful and personal, energetic pop style",
  lover:       "Romantic ballad with tender emotional depth, intimate and heartfelt, soft piano and strings",
  mother:      "Warm nurturing melody with gratitude and deep love, gentle and emotional, acoustic guitar",
  friendship:  "Uplifting song about bonds and shared memories, nostalgic and joyful, indie pop feel",
  anniversary: "Elegant romantic piece with timeless quality, sophisticated and loving, orchestral pop",
  father:      "Strong yet tender melody expressing gratitude and admiration, warm acoustic folk",
  graduation:  "Triumphant celebratory melody with hope and new beginnings, cinematic and uplifting",
  wedding:     "Beautiful wedding ballad with eternal love theme, orchestral and deeply emotional",
  gratitude:   "Heartfelt gratitude song with warmth and sincerity, gentle acoustic and vocal",
  ramadan:     "Spiritual and peaceful Ramadan melody with reverence and community warmth, soft and devotional",
  christmas:   "Joyful Christmas song with warmth and family feeling, festive and heartwarming",
  custom:      "",
};

router.post("/enhance-prompt", async (req, res) => {
  const { prompt, genres } = req.body as { prompt?: string; genres?: string[] };
  if (!prompt?.trim() && (!genres || genres.length === 0)) {
    return res.status(400).json({ error: "Prompt atau genre wajib diisi" });
  }
  try {
    const { title, enhancedPrompt, lyrics, timepoints, inputTokens, outputTokens } = await generateEnhancedPromptWithTimepoints({
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
    return res.json({ title, enhancedPrompt, lyrics, timepoints });
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

  if (!(req as any).servicePhone) {
    const user = await getOrCreateUserAsync(phone);
    if (user.credits < MUSIC_CREDITS) {
      return res.status(402).json({ error: "Kredit tidak cukup", credits: user.credits });
    }
    const deducted = await deductCreditsAsync(phone, MUSIC_CREDITS);
    if (!deducted) {
      return res.status(402).json({ error: "Kredit tidak cukup", credits: getCredits(phone) });
    }
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
    enhancedPrompt: job.enhanced_prompt,
    lyrics: job.lyrics,
    timepoints: job.timepoints_json ? JSON.parse(job.timepoints_json) : null,
    title: job.title,
    error: job.error,
  });
});

router.get("/history", (req, res) => {
  const phone = req.user!.phone;
  const jobs = getMusicJobsByPhone(phone);
  const novelMap = getNovelSummariesForPhone(phone);
  const albumMap = getAlbumMapForPhone(phone);
  const jobsWithMeta = jobs.map(j => ({
    ...j,
    novel: novelMap[j.id] ?? null,
    album: albumMap[j.id] ?? null,
  }));
  return res.json({ jobs: jobsWithMeta });
});

// ── POST /api/music/upload-recording ─────────────────────────────────────────
// Accepts multipart/form-data with field "recording" (audio blob from browser).
// Returns { url: "https://storage.googleapis.com/..." }

router.post("/upload-recording", upload.single("recording"), async (req, res) => {
  const file = req.file;

  // Validate file presence
  if (!file) {
    return res.status(400).json({ error: "File rekaman wajib diupload (field: recording)" });
  }

  // Validate size (belt-and-suspenders on top of multer limit)
  if (file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Ukuran file terlalu besar (maks 5 MB)" });
  }

  // Validate mimetype
  if (!file.mimetype.startsWith("audio/")) {
    return res.status(400).json({ error: "File harus berformat audio" });
  }

  // Derive extension from mimetype
  let ext = "bin";
  if (file.mimetype === "audio/webm" || file.mimetype.includes("webm")) ext = "webm";
  else if (
    file.mimetype === "audio/mp4" ||
    file.mimetype === "audio/x-m4a" ||
    file.mimetype === "audio/mpeg" ||
    file.mimetype === "audio/mp3"
  ) ext = "mp4";

  if (!_gcsStorage || !_gcsBucketName) {
    return res.status(503).json({ error: "GCS not configured" });
  }

  const phone = (req.user?.phone) ?? "anonymous";
  const filename = `recordings/${phone}/${nanoid()}.${ext}`;

  try {
    const gcsFile = _gcsStorage.bucket(_gcsBucketName).file(filename);
    await gcsFile.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
      predefinedAcl: "publicRead",
    });
    await gcsFile.makePublic().catch(err =>
      console.warn("[GCS] makePublic failed for recording:", (err as Error).message)
    );
    const url = `https://storage.googleapis.com/${_gcsBucketName}/${filename}`;
    return res.json({ url });
  } catch (err: any) {
    console.error("[Music] Recording upload to GCS failed:", err);
    return res.status(500).json({ error: "Upload rekaman gagal" });
  }
});

// ── POST /api/music/generate-from-melody ─────────────────────────────────────
// Auth required. Body: { recordingUrl, occasion, duration? }
// Deducts 1 credit, starts a LeVo job async, returns 202 { jobId, creditsRemaining }.
// Status polling reuses GET /api/music/status/:jobId.

router.post("/generate-from-melody", async (req, res) => {
  const phone = req.user!.phone;
  const { recordingUrl, occasion, duration } = req.body as {
    recordingUrl?: string;
    occasion?: string;
    duration?: number;
  };

  // Validate inputs
  if (!recordingUrl || typeof recordingUrl !== "string") {
    return res.status(400).json({ error: "recordingUrl wajib diisi" });
  }
  // Validate that the recording URL is from our GCS bucket
  if (!recordingUrl.startsWith(`https://storage.googleapis.com/${_gcsBucketName}/recordings/`)) {
    return res.status(400).json({ error: "recordingUrl tidak valid" });
  }
  if (!occasion || typeof occasion !== "string") {
    return res.status(400).json({ error: "occasion wajib diisi" });
  }

  const occasionPrompt = OCCASION_PROMPTS[occasion] ?? OCCASION_PROMPTS["custom"];

  // Deduct 1 credit
  const user = await getOrCreateUserAsync(phone);
  if (user.credits < MUSIC_CREDITS) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: user.credits });
  }
  const deducted = await deductCreditsAsync(phone, MUSIC_CREDITS);
  if (!deducted) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: getCredits(phone) });
  }

  const jobId = nanoid();
  const title = `${occasion} — Lovemelodia (Melodi)`;

  // Create job row (same as /generate)
  createMusicJob(jobId, phone, occasion, title, occasionPrompt);
  void createMusicJobInSupabase({ id: jobId, phone, prompt: occasion, enhanced_prompt: occasionPrompt });

  // Fire-and-forget async generation
  (async () => {
    try {
      updateMusicJob(jobId, "generating");
      void updateMusicJobInSupabase(jobId, "generating");

      const trackDuration = Math.min(Number(duration ?? 30), 30);
      const { audioUrl } = await generateFromMelody({
        prompt: occasionPrompt || "melodic song based on hummed melody",
        prompt_audio: recordingUrl,
        duration: trackDuration,
      });

      logCost({ phone, service: "wavespeed", operation: "generateFromMelody", costUsd: 0.08 });
      updateMusicJob(jobId, "completed", audioUrl, undefined, occasionPrompt);
      void updateMusicJobInSupabase(jobId, "completed", audioUrl, null, occasionPrompt);
    } catch (err: any) {
      console.error(`[Music] LeVo job ${jobId} failed:`, err);
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

// ── Story question sets by occasion ──────────────────────────────────────────
const STORY_QUESTIONS: Record<string, string[]> = {
  birthday: [
    "Apa pencapaian terbesar orang ini yang kamu paling bangga?",
    "Ceritain satu momen lucu atau tak terlupakan bersama dia.",
    "Kalau bisa kasih satu kalimat semangat buat dia, apa yang mau kamu bilang?",
  ],
  mother: [
    "Apa kenangan paling berkesan yang kamu punya bersama ibumu?",
    "Kalimat atau nasihat ibu yang selalu kamu ingat sampai sekarang?",
    "Momen apa yang paling bikin kamu merasa ibumu benar-benar ada buat kamu?",
    "Kalau bisa bilang satu hal ke ibu sekarang, apa itu?",
  ],
  lover: [
    "Momen pertama kamu sadar kamu jatuh cinta sama dia?",
    "Hal terkecil yang dia lakuin yang bikin kamu senyum sendiri?",
    "Kalau harus describe dia dalam satu lagu, genre apa dan kenapa?",
  ],
  friendship: [
    "Kenangan paling lucu atau berkesan kalian berdua?",
    "Apa yang kamu paling syukuri dari persahabatan ini?",
    "Kalau dia lagi jauh, apa yang paling kamu kangen?",
  ],
  anniversary: [
    "Momen paling berkesan dari perjalanan kalian bersama?",
    "Hal apa yang paling kamu cintai dari dia sekarang — yang mungkin tidak kamu lihat di awal?",
    "Kalau bisa ulang satu hari bersama dia, hari apa itu?",
  ],
  graduation: [
    "Perjalanan terberat apa yang dia lalui untuk sampai di sini?",
    "Apa yang bikin kamu paling bangga sama dia?",
    "Harapan apa yang kamu doakan buat masa depannya?",
  ],
  father: [
    "Momen paling berkesan bersama ayahmu yang tidak bisa kamu lupakan?",
    "Hal apa yang kamu pelajari dari ayah yang masih kamu bawa sampai sekarang?",
    "Apa yang pengen kamu bilang ke ayah yang belum pernah terucap?",
  ],
};

const STORY_QUESTIONS_DEFAULT = [
  "Siapa yang ingin kamu kirimi lagu ini?",
  "Momen apa yang ingin kamu rayakan atau kenang?",
  "Perasaan apa yang ingin kamu sampaikan lewat lagu ini?",
];

// ── POST /api/music/build-story ───────────────────────────────────────────────
// Auth: applied at router level (serviceAuthOrRequireAuth)
// Body: { occasion: string, answers: string[] }
// Returns: { enhancedPrompt: string, lyricHints: string }

router.post("/build-story", async (req, res) => {
  const { occasion, answers } = req.body as { occasion?: string; answers?: string[] };

  if (!occasion || typeof occasion !== "string") {
    return res.status(400).json({ error: "occasion wajib diisi" });
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: "answers wajib diisi" });
  }

  const questions = STORY_QUESTIONS[occasion] ?? STORY_QUESTIONS_DEFAULT;
  const occasionLabel = OCCASION_PROMPTS[occasion] !== undefined
    ? (Object.entries({
        birthday: "Ulang Tahun", lover: "Untuk Kekasih", mother: "Untuk Ibu",
        friendship: "Persahabatan", anniversary: "Anniversary", father: "Untuk Ayah",
        graduation: "Wisuda", wedding: "Pernikahan", gratitude: "Terima Kasih",
        ramadan: "Ramadan", christmas: "Natal", custom: "Bebas",
      }).find(([k]) => k === occasion)?.[1] ?? occasion)
    : occasion;

  const storiesBlock = answers
    .map((a, i) => {
      const q = questions[i] ?? `Pertanyaan ${i + 1}`;
      return `Q: ${q}\nA: ${a.trim()}`;
    })
    .join("\n\n");

  const systemPrompt = `Kamu adalah penulis lagu profesional yang membuat lagu hadiah personal untuk orang-orang terkasih.
Dari cerita nyata yang diberikan pengguna, buat:
1. enhancedPrompt: prompt musik vivid untuk AI generator Lyria (maks 200 karakter, Bahasa Inggris), memasukkan detail emosional spesifik dari cerita
2. lyricHints: 2-3 baris lirik atau bayangan puitis (Bahasa Indonesia) yang akan membimbing narasi lagu

Respons HANYA dalam format JSON valid (tanpa markdown):
{
  "enhancedPrompt": "...",
  "lyricHints": "..."
}

Gunakan detail spesifik dari cerita mereka — hindari frasa klise atau generik. Buat se-personal dan se-emosional mungkin.`;

  const userPrompt = `Ocasion: ${occasionLabel}

Cerita dari pengguna:
${storiesBlock}

Buat enhancedPrompt (maks 200 karakter, Inggris) dan lyricHints (2-3 baris, Indonesia).`;

  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = (msg.content[0] as { text: string }).text.trim();

    // Parse JSON — try multiple strategies
    let parsed: { enhancedPrompt?: string; lyricHints?: string } = {};
    try { parsed = JSON.parse(rawText); } catch { /* fall through */ }
    if (!parsed.enhancedPrompt) {
      const blockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (blockMatch) { try { parsed = JSON.parse(blockMatch[1]); } catch { /* ignore */ } }
    }
    if (!parsed.enhancedPrompt) {
      const braceMatch = rawText.match(/\{[\s\S]*\}/);
      if (braceMatch) { try { parsed = JSON.parse(braceMatch[0]); } catch { /* ignore */ } }
    }

    const enhancedPrompt = (parsed.enhancedPrompt ?? OCCASION_PROMPTS[occasion] ?? "").slice(0, 200);
    const lyricHints = parsed.lyricHints ?? "";

    logCost({
      phone: req.user!.phone,
      service: "claude",
      operation: "buildStory",
      costUsd: calculateClaudeCost("claude-sonnet-4-6", msg.usage.input_tokens, msg.usage.output_tokens),
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    });

    return res.json({ enhancedPrompt, lyricHints });
  } catch (err: any) {
    console.error("[Music] build-story Claude failed:", err);
    // Graceful fallback — return the default occasion prompt
    return res.json({
      enhancedPrompt: (OCCASION_PROMPTS[occasion] ?? "").slice(0, 200),
      lyricHints: "",
    });
  }
});

export default router;
