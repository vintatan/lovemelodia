const MUSIC_ENDPOINT = "https://api.wavespeed.ai/api/v3/google/lyria-3-pro/music";

const INDONESIAN_PREFIX = "Indonesian language song, bahasa Indonesia vocals and lyrics, indie sound, natural organic production, authentic feel. ";

export async function generateMusic(prompt: string): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not set");

  const finalPrompt = prompt.toLowerCase().includes("indonesian") ? prompt : INDONESIAN_PREFIX + prompt;

  const submitRes = await fetch(MUSIC_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: finalPrompt }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`Music generation failed (${submitRes.status}): ${text}`);
  }

  const submitData = await submitRes.json() as {
    data?: { id?: string; urls?: { get?: string }; status?: string; outputs?: string[] };
    detail?: string;
  };

  if (submitData.data?.status === "completed") {
    const url = submitData.data.outputs?.[0];
    if (!url) throw new Error("Music generation completed but no output URL found");
    return url;
  }

  const taskId = submitData.data?.id;
  const pollUrl = submitData.data?.urls?.get;
  if (!taskId || !pollUrl) {
    throw new Error(`Music generation failed: ${submitData.detail ?? JSON.stringify(submitData)}`);
  }

  // Poll with increasing backoff — music generation takes 60–120s
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, i < 6 ? 5000 : 10000));
    const poll = await fetch(pollUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    const pd = await poll.json() as { data?: { status?: string; outputs?: string[]; error?: string } };
    const status = pd.data?.status;
    if (status === "completed") {
      const url = pd.data?.outputs?.[0];
      if (!url) throw new Error("Music generation completed but no output URL found");
      return url;
    }
    if (status === "failed") throw new Error(pd.data?.error ?? "Music generation failed");
  }
  throw new Error("Music generation timed out after ~10 minutes");
}
