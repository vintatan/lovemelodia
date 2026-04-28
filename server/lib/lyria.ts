/**
 * WaveSpeed Lyria 3 Pro music generation.
 * Endpoint follows the same submit-then-poll pattern as other WaveSpeed models.
 */

const LYRIA_ENDPOINT = "https://api.wavespeed.ai/api/v3/google/lyria-3-pro";

export async function generateMusic(prompt: string): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not set");

  const submitRes = await fetch(LYRIA_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`Lyria 3 Pro submit failed (${submitRes.status}): ${text}`);
  }

  const submitData = await submitRes.json() as {
    data?: { id?: string; urls?: { get?: string }; status?: string; outputs?: string[] };
    detail?: string;
  };

  // If sync mode returned immediately
  if (submitData.data?.status === "completed") {
    const url = submitData.data.outputs?.[0];
    if (!url) throw new Error("Lyria 3 Pro completed immediately but no output URL");
    return url;
  }

  const taskId = submitData.data?.id;
  const pollUrl = submitData.data?.urls?.get;
  if (!taskId || !pollUrl) {
    throw new Error(`Lyria 3 Pro submit failed: ${submitData.detail ?? JSON.stringify(submitData)}`);
  }

  // Poll with increasing backoff — music generation takes 60–120s
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, i < 6 ? 5000 : 10000));
    const poll = await fetch(pollUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    const pd = await poll.json() as { data?: { status?: string; outputs?: string[]; error?: string } };
    const status = pd.data?.status;
    if (status === "completed") {
      const url = pd.data?.outputs?.[0];
      if (!url) throw new Error("Lyria 3 Pro completed but no output URL");
      return url;
    }
    if (status === "failed") throw new Error(pd.data?.error ?? "Lyria 3 Pro generation failed");
  }
  throw new Error("Lyria 3 Pro timeout after ~10 minutes");
}
