/**
 * WaveSpeed Song Generation (LeVo) client.
 * Submits a job then polls until completion — same pattern as lyria.ts.
 * Estimated cost: ~$0.08 per 30-second generation.
 */

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";
const SONG_ENDPOINT = `${WAVESPEED_BASE}/wavespeed-ai/song-generation`;
const RESULTS_ENDPOINT = `${WAVESPEED_BASE}/results`;

// Cost estimate per generation (~30s track)
const LEVO_COST_USD = 0.08;

export interface LeVoRequest {
  prompt: string;       // style/mood description
  lyric?: string;       // optional lyric text
  prompt_audio: string; // public URL of the user's hummed/sung recording
  duration: number;     // seconds, max 30
}

export interface LeVoJobResult {
  audioUrl: string;
}

export async function generateFromMelody(req: LeVoRequest): Promise<LeVoJobResult> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not set");

  // ── Step 1: Submit job ──────────────────────────────────────────────────────
  const submitRes = await fetch(SONG_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: req.prompt,
      ...(req.lyric ? { lyric: req.lyric } : {}),
      prompt_audio: req.prompt_audio,
      duration: req.duration,
    }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`Song generation submit failed (${submitRes.status}): ${text}`);
  }

  const submitData = await submitRes.json() as {
    data?: { id?: string; status?: string; outputs?: string[]; error?: string };
    detail?: string;
  };

  // Handle synchronous completion (unlikely but possible)
  if (submitData.data?.status === "completed") {
    const url = submitData.data.outputs?.[0];
    if (!url) throw new Error("Song generation completed but no output URL found");
    console.log(`[LeVo] Song generated (sync). Est. cost: $${LEVO_COST_USD.toFixed(2)}`);
    return { audioUrl: url };
  }

  const taskId = submitData.data?.id;
  if (!taskId) {
    throw new Error(`Song generation failed: ${submitData.detail ?? JSON.stringify(submitData)}`);
  }

  // ── Step 2: Poll every 3s, timeout after 3 minutes (60 polls) ──────────────
  const pollUrl = `${RESULTS_ENDPOINT}/${taskId}`;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));

    const poll = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const pd = await poll.json() as {
      data?: { status?: string; outputs?: string[]; error?: string };
    };

    const status = pd.data?.status;

    if (status === "completed") {
      const url = pd.data?.outputs?.[0];
      if (!url) throw new Error("Song generation completed but no output URL found");
      console.log(`[LeVo] Song generated after ${i + 1} polls (~${((i + 1) * 3)}s). Est. cost: $${LEVO_COST_USD.toFixed(2)}`);
      return { audioUrl: url };
    }

    if (status === "failed") {
      throw new Error(pd.data?.error ?? "Song generation failed");
    }

    // Still processing — continue polling
  }

  throw new Error("Generasi timeout — coba lagi");
}
