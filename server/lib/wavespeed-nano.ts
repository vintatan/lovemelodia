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

  const data = await res.json() as {
    data?: { status?: string; outputs?: string[]; error?: string; urls?: { get?: string } };
    code?: number; message?: string; detail?: string;
  };

  if (data.data?.status === "completed") {
    const url = data.data.outputs?.[0];
    if (!url) throw new Error("No output URL in completed response");
    return url;
  }

  const pollUrl = data.data?.urls?.get;
  if (!pollUrl) {
    throw new Error(`Submit failed: ${data.message ?? data.detail ?? JSON.stringify(data)}`);
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
    prompt: `${characterPrompt}, photorealistic portrait, beautiful, sharp focus, natural lighting, high quality, 8k`,
    size: "720*1280",
    enable_sync_mode: true,
    num_inference_steps: 28,
    guidance_scale: 3.5,
  }, apiKey);
}

export async function generateNanoBananaImage(prompt: string, characterImageBase64: string): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not set");

  return wavespeedPost(EDIT_ENDPOINT, {
    prompt: `Image 1 is the character reference: preserve their face, hair, skin tone, and outfit exactly across all scenes. ${prompt}, photorealistic, beautiful, cinematic lighting, high quality, 8k`,
    images: [`data:image/jpeg;base64,${characterImageBase64}`],
    size: "1280*720",
    enable_sync_mode: true,
  }, apiKey);
}
