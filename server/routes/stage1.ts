import { Router } from "express";
import { nanoid } from "nanoid";
import { getOrCreateUserAsync, deductCreditsAsync, getCredits, createProject, getProject, saveStage1Result } from "../lib/db.js";
import { enhancePromptAndTimepoints } from "../lib/anthropic.js";
import { uploadToGcs } from "../lib/gcs.js";
import { logCost, calculateClaudeCost } from "../lib/cost-logger.js";
import { bqTrackProject } from "../lib/bigquery.js";
import { generationRateLimit } from "../middleware/rateLimit.js";

const router = Router();
const STAGE1_CREDITS = 5;

router.post("/enhance", generationRateLimit, async (req, res) => {
  const phone = req.user!.phone;

  const {
    projectId: existingId,
    characterImageBase64,
    characterDesc = "",
    theme = "real life",
    musicVibe = "",
  } = req.body as {
    projectId?: string;
    characterImageBase64?: string | null;
    characterDesc?: string;
    theme?: string;
    musicVibe?: string;
  };

  if (!musicVibe) return res.status(400).json({ error: "musicVibe is required" });

  // Ensure user exists and has credits
  const user = await getOrCreateUserAsync(phone);
  if (user.credits < STAGE1_CREDITS) {
    return res.status(402).json({ error: "Insufficient credits", credits: user.credits });
  }

  // Upload character image to GCS if provided
  let characterImageUrl: string | null = null;
  if (characterImageBase64) {
    const imgBuf = Buffer.from(characterImageBase64, "base64");
    characterImageUrl = await uploadToGcs(imgBuf, "image/jpeg", "characters", phone);
  }

  // Create or load project
  let projectId = existingId;
  if (!projectId) {
    projectId = nanoid();
    createProject({ id: projectId, phone, theme, musicVibe, characterDesc, characterImageUrl });
  }

  // Deduct credits
  const deducted = await deductCreditsAsync(phone, STAGE1_CREDITS);
  if (!deducted) {
    return res.status(402).json({ error: "Insufficient credits", credits: getCredits(phone) });
  }

  try {
    const { result, inputTokens, outputTokens } = await enhancePromptAndTimepoints({
      characterDesc,
      theme,
      musicVibe,
      characterImageBase64: characterImageBase64 ?? null,
    });

    saveStage1Result(projectId, {
      enhancedPrompt: result.enhancedPrompt,
      timepointsJson: JSON.stringify(result.timepoints),
      creditsUsed: STAGE1_CREDITS,
    });

    const costUsd = calculateClaudeCost("claude-sonnet-4-6", inputTokens, outputTokens);
    logCost({ phone, service: "claude", operation: "enhancePrompt", model: "claude-sonnet-4-6", costUsd, inputTokens, outputTokens });
    bqTrackProject({ projectId, phone, stage: "stage1", theme, status: "completed" });

    return res.json({
      projectId,
      enhancedPrompt: result.enhancedPrompt,
      timepoints: result.timepoints,
      creditsUsed: STAGE1_CREDITS,
      creditsRemaining: getCredits(phone),
    });
  } catch (err: any) {
    console.error("[Stage1] enhance error:", err);
    // Refund credits on Claude failure
    const { addCreditsAsync } = await import("../lib/db.js");
    await addCreditsAsync(phone, STAGE1_CREDITS, "refund");
    return res.status(500).json({ error: "Prompt enhancement failed. Credits refunded." });
  }
});

// Reload existing stage1 result
router.get("/project/:id", async (req, res) => {
  const phone = req.user!.phone;
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });
  if (project.phone !== phone) return res.status(403).json({ error: "Forbidden" });
  return res.json({ project });
});

export default router;
