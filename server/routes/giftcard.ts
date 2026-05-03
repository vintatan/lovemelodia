import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/auth.js";
import {
  getMusicJob,
  createShareLink,
  getShareLink,
  updateShareLinkAssets,
  updateVinylAssets,
  deductCreditsAsync,
  getCredits,
} from "../lib/db.js";
import { uploadToGcs } from "../lib/gcs.js";
import { TEMPLATES, generateGiftCardAssets, generateVinylAssets, cleanupTmpFiles } from "../lib/giftcard.js";
import sharp from "sharp";
import fs from "fs";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── GET /api/giftcard/templates (public) ─────────────────────────────────────

router.get("/templates", (_req, res) => {
  return res.json({ templates: TEMPLATES });
});

// ── POST /api/giftcard/upload-photo (auth required) ──────────────────────────

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];

router.post("/upload-photo", requireAuth, upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

  if (!ACCEPTED_IMAGE_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "Format foto tidak didukung. Gunakan JPG, PNG, atau WebP." });
  }

  const phone = req.user!.phone;
  try {
    const jpegBuffer = await sharp(req.file.buffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // flatten PNG/HEIC transparency to white
      .rotate()                                               // auto-rotate per EXIF orientation
      .resize(1080, 1080, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: false,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    const url = await uploadToGcs(jpegBuffer, "image/jpeg", "giftcard-photos", phone);
    if (!url) return res.status(500).json({ error: "Upload gagal" });
    return res.json({ photoUrl: url });
  } catch (err: any) {
    console.error("[giftcard/upload-photo]", err);
    // HEIC might not be supported in all environments
    if (err.message?.includes("heic") || err.message?.includes("HEIC")) {
      return res.status(400).json({ error: "Format HEIC belum didukung — silakan convert ke JPG terlebih dahulu." });
    }
    return res.status(500).json({ error: err.message ?? "Gagal upload foto" });
  }
});

// ── POST /api/giftcard/generate (auth required) ───────────────────────────────

router.post("/generate", requireAuth, async (req, res) => {
  const phone = req.user!.phone;
  const { musicJobId, templateId, message, photoUrl } = req.body as {
    musicJobId?: string;
    templateId?: string;
    message?: string;
    photoUrl?: string;
  };

  if (!musicJobId) return res.status(400).json({ error: "musicJobId wajib diisi" });
  if (!templateId) return res.status(400).json({ error: "templateId wajib diisi" });
  if (!message?.trim()) return res.status(400).json({ error: "Pesan wajib diisi" });
  if (message.trim().length > 60) return res.status(400).json({ error: "Pesan maksimal 60 karakter" });

  const job = getMusicJob(musicJobId);
  if (!job) return res.status(404).json({ error: "Music job tidak ditemukan" });
  if (job.phone !== phone) return res.status(403).json({ error: "Akses ditolak" });
  if (job.status !== "completed") return res.status(400).json({ error: "Musik belum selesai diproses" });

  const validTemplate = TEMPLATES.find(t => t.id === templateId);
  if (!validTemplate) return res.status(400).json({ error: "Template tidak valid" });

  const shareId = nanoid(10);
  createShareLink(shareId, musicJobId, message.trim(), templateId);

  // Respond immediately with 202 — generation happens async
  res.status(202).json({ shareId });

  // Async generation (fire-and-forget)
  (async () => {
    const tmpPaths: string[] = [];
    try {
      const result = await generateGiftCardAssets({
        musicJob: job,
        templateId,
        message: message.trim(),
        shareId,
        photoUrl,
      });

      if (result.audioPath) tmpPaths.push(result.audioPath);
      tmpPaths.push(result.storiesPath);

      // Upload feed image
      const feedTmpPath = `/tmp/${shareId}-feed.png`;
      tmpPaths.push(feedTmpPath);
      const imageUrl = await uploadToGcs(result.feedBuffer, "image/jpeg", `gifts/${shareId}`, null)
        // upload as PNG using a workaround: write to tmp then use gcs directly
        .catch(() => null);

      // For PNG, upload directly
      const pngUrl = await uploadPngToGcs(result.feedBuffer, `gifts/${shareId}/feed.png`);
      const printUrl = await uploadPngToGcs(result.printBuffer, `gifts/${shareId}/print.png`);

      // Upload stories video if generated
      let videoUrl: string | null = null;
      if (fs.existsSync(result.storiesPath) && fs.statSync(result.storiesPath).size > 0) {
        const videoBuf = fs.readFileSync(result.storiesPath);
        videoUrl = await uploadToGcs(videoBuf, "video/mp4", `gifts/${shareId}`, null);
      }

      // Cleanup tmp files
      const printTmpPath = `/tmp/${shareId}-print.png`;
      tmpPaths.push(printTmpPath);
      cleanupTmpFiles(tmpPaths);

      updateShareLinkAssets(shareId, pngUrl, videoUrl, printUrl);
    } catch (err) {
      console.error("[giftcard/generate] async generation failed:", err);
      cleanupTmpFiles(tmpPaths);
    }
  })();
});

// Helper: upload a PNG buffer to GCS at a specific path
async function uploadPngToGcs(buffer: Buffer, gcsPath: string): Promise<string | null> {
  const { Storage } = await import("@google-cloud/storage");
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) return null;
  try {
    const storage = new Storage();
    const file = storage.bucket(bucketName).file(gcsPath);
    await file.save(buffer, { contentType: "image/png", resumable: false, predefinedAcl: "publicRead" });
    await file.makePublic().catch(() => {});
    return `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
  } catch (err) {
    console.error("[giftcard] uploadPngToGcs failed:", err);
    return null;
  }
}

// ── GET /api/giftcard/status/:shareId (auth required) ───────────────────────

router.get("/status/:shareId", requireAuth, async (req, res) => {
  const link = getShareLink(req.params.shareId);
  if (!link) return res.status(404).json({ error: "Share link tidak ditemukan" });

  const job = getMusicJob(link.music_job_id);
  if (!job || job.phone !== req.user!.phone) {
    return res.status(403).json({ error: "Akses ditolak" });
  }

  const isDone = !!(link.image_url && link.print_tag_url);
  return res.json({
    status: isDone ? "done" : "pending",
    shareId: link.id,
    imageUrl: link.image_url,
    videoUrl: link.video_url,
    printTagUrl: link.print_tag_url,
    shareUrl: `https://lovemelodia.com/gift/${link.id}`,
  });
});

// ── POST /api/giftcard/generate-vinyl (auth required) ────────────────────────

router.post("/generate-vinyl", requireAuth, async (req, res) => {
  const phone = req.user!.phone;
  const { shareId, recipientName, trackTitle } = req.body as {
    shareId?: string;
    recipientName?: string;
    trackTitle?: string;
  };

  if (!shareId) return res.status(400).json({ error: "shareId wajib diisi" });

  const link = getShareLink(shareId);
  if (!link) return res.status(404).json({ error: "Share link tidak ditemukan" });

  // Verify ownership via music_job
  const job = getMusicJob(link.music_job_id);
  if (!job || job.phone !== phone) {
    return res.status(403).json({ error: "Akses ditolak" });
  }

  // Check credits (vinyl costs 1 credit)
  const credits = getCredits(phone);
  if (credits < 1) {
    return res.status(402).json({ error: "Kredit tidak cukup untuk membuat vinyl card" });
  }

  // Deduct 1 credit (premium vinyl add-on)
  const deducted = await deductCreditsAsync(phone, 1);
  if (!deducted) {
    return res.status(402).json({ error: "Kredit tidak cukup untuk membuat vinyl card" });
  }

  // Respond immediately with 202 — generation happens async
  res.status(202).json({ shareId });

  // Async generation (fire-and-forget)
  (async () => {
    const tmpPaths: string[] = [];
    try {
      const template = TEMPLATES.find(t => t.id === link.template_id) ?? TEMPLATES[0];
      const result = await generateVinylAssets({
        shareId,
        occasionLabel: template.label,
        recipientName: recipientName?.slice(0, 30),
        trackTitle: (trackTitle ?? job.title ?? "Lagu Untukmu").slice(0, 22),
        templateColor: template.color,
        audioUrl: job.audio_url ?? "",
      });

      tmpPaths.push(result.vinylVideoPath);

      // Upload vinyl card PNG
      const vinylCardUrl = await uploadPngToGcs(result.vinylCardBuffer, `giftcards/${shareId}/vinyl-card.png`);

      // Upload vinyl video MP4
      let vinylVideoUrl: string | null = null;
      const { default: fs } = await import("fs");
      if (fs.existsSync(result.vinylVideoPath) && fs.statSync(result.vinylVideoPath).size > 0) {
        const videoBuf = fs.readFileSync(result.vinylVideoPath);
        vinylVideoUrl = await uploadToGcs(videoBuf, "video/mp4", `giftcards/${shareId}`, null);
      }

      cleanupTmpFiles(tmpPaths);
      updateVinylAssets(shareId, vinylCardUrl, vinylVideoUrl);
    } catch (err) {
      console.error("[giftcard/generate-vinyl] async generation failed:", err);
      cleanupTmpFiles(tmpPaths);
    }
  })();
});

// ── GET /api/giftcard/vinyl-status/:shareId (auth required) ──────────────────

router.get("/vinyl-status/:shareId", requireAuth, async (req, res) => {
  const link = getShareLink(req.params.shareId);
  if (!link) return res.status(404).json({ error: "Share link tidak ditemukan" });

  const job = getMusicJob(link.music_job_id);
  if (!job || job.phone !== req.user!.phone) {
    return res.status(403).json({ error: "Akses ditolak" });
  }

  const isDone = !!(link.vinyl_card_url && link.vinyl_video_url);
  return res.json({
    status: isDone ? "done" : "pending",
    vinylCardUrl: link.vinyl_card_url ?? null,
    vinylVideoUrl: link.vinyl_video_url ?? null,
  });
});

// ── GET /api/public/gift/:shareId (no auth) ──────────────────────────────────

router.get("/gift/:shareId", async (req, res) => {
  const link = getShareLink(req.params.shareId);
  if (!link) return res.status(404).json({ error: "Link tidak ditemukan" });

  const job = getMusicJob(link.music_job_id);
  const template = TEMPLATES.find(t => t.id === link.template_id);

  return res.json({
    shareId: link.id,
    templateId: link.template_id,
    occasion: template?.label ?? link.template_id,
    templateColor: template?.color ?? "#333333",
    message: link.message,
    imageUrl: link.image_url,
    videoUrl: link.video_url,
    printTagUrl: link.print_tag_url,
    audioUrl: job?.audio_url ?? null,
    title: job?.title ?? "Lagu Untukmu",
  });
});

export default router;
