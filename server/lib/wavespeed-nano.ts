// Character portrait generation — text-to-image, no reference needed
const T2I_ENDPOINT = "https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-dev-ultra-fast";
// Storyboard frame generation — always image-guided for character consistency
const EDIT_ENDPOINT = "https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit";

async function wavespeedPost(endpoint: string, body: Record<string, unknown>, apiKey: string): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data: { data?: { status?: string; outputs?: string[]; error?: string; urls?: { get?: string } }; code?: number; message?: string; detail?: string };
  try { data = JSON.parse(raw); } catch { throw new Error(`WaveSpeed non-JSON response (${res.status}): ${raw.slice(0, 300)}`); }

  if (!res.ok || data.code === 400 || data.code === 401 || data.code === 403) {
    throw new Error(`WaveSpeed error (${res.status}): ${data.message ?? data.detail ?? raw.slice(0, 300)}`);
  }

  if (data.data?.status === "completed") {
    const url = data.data.outputs?.[0];
    if (!url) throw new Error("No output URL in completed response");
    return url;
  }

  const pollUrl = data.data?.urls?.get;
  if (!pollUrl) {
    throw new Error(`Submit failed: ${data.message ?? data.detail ?? raw.slice(0, 300)}`);
  }

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, i < 5 ? 2000 : 5000));
    const poll = await fetch(pollUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    const pd = await poll.json() as { data?: { status?: string; outputs?: string[]; error?: string } };
    if (pd.data?.status === "completed") {
      const url = pd.data.outputs?.[0];
      if (!url) throw new Error("Completed with no output");
      return url;
    }
    if (pd.data?.status === "failed") throw new Error(pd.data.error ?? "Generation failed");
  }
  throw new Error("Generation timed out");
}

export async function generateCharacterPortrait(characterPrompt: string): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not set");

  return wavespeedPost(T2I_ENDPOINT, {
    prompt: `${characterPrompt}, photorealistic portrait, attractive, striking features, flawless skin, expressive eyes, soft cinematic lighting, shallow depth of field, editorial fashion quality, high quality, 8k`,
    negative_prompt: "nsfw, nudity, nude, naked, sexual, explicit, suggestive, revealing clothing, cleavage, lingerie, violence, blood, gore, weapons, disturbing, horror, scary, dark, ugly, deformed, disfigured, watermark, text",
    size: "720*1280",
    enable_sync_mode: true,
    num_inference_steps: 35,
    guidance_scale: 4.0,
  }, apiKey);
}

export async function generateNanoBananaImage(prompt: string, characterImageUrl: string): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not set");

  return wavespeedPost(EDIT_ENDPOINT, {
    prompt: `${prompt}, photorealistic, beautiful, surreal, cinematic lighting, high quality, 8k, widescreen landscape 16:9. Image 1 provides a loose character aesthetic reference only`,
    negative_prompt: "nsfw, nudity, nude, naked, sexual, explicit, suggestive, revealing clothing, cleavage, lingerie, violence, blood, gore, weapons, disturbing, horror, scary, dark, ugly, deformed, disfigured, watermark, text",
    images: [characterImageUrl],
    size: "1280*720",
    enable_sync_mode: true,
  }, apiKey);
}
