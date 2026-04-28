export const DUMMY_IMAGE = "https://placehold.co/1080x1920.jpg";

const SEEDREAM_SIZE_MAP: Record<string, string> = {
  "9:16": "1080*1920",
  "1:1":  "1024*1024",
  "16:9": "1920*1080",
};

/**
 * Generate a photorealistic storyboard frame using WaveSpeed Seedream v4.5.
 * The character image is passed as a face-preservation reference.
 */
export async function generateStoryboardFrame(params: {
  prompt: string;
  characterImageBase64?: string | null;
  aspectRatio?: string;
}): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) return DUMMY_IMAGE;

  const { prompt, characterImageBase64, aspectRatio = "9:16" } = params;
  const images: string[] = [];
  const roles: string[] = [];

  if (characterImageBase64) {
    images.push(`data:image/jpeg;base64,${characterImageBase64}`);
    roles.push("Image 1 is the subject: preserve their face, hair, outfit, and body exactly; replace only the background");
  }

  const rolePrefix = roles.length > 0 ? roles.join(". ") + ". " : "";

  const res = await fetch("https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      images,
      prompt: rolePrefix + prompt + ". Photorealistic, cinematic lighting, high detail.",
      size: SEEDREAM_SIZE_MAP[aspectRatio] ?? "1080*1920",
      enable_sync_mode: true,
    }),
  });

  const data = await res.json() as {
    data?: { status?: string; outputs?: string[]; error?: string; urls?: { get?: string } };
    detail?: string;
  };

  if (data.data?.status === "completed") {
    const url = data.data.outputs?.[0];
    if (!url) throw new Error("Seedream returned no output");
    return url;
  }

  // Sync mode didn't complete — fall back to polling
  const pollUrl = data.data?.urls?.get;
  if (!pollUrl) throw new Error(`Seedream submit failed: ${data.detail ?? JSON.stringify(data)}`);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, i < 5 ? 2000 : 5000));
    const poll = await fetch(pollUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    const pd = await poll.json() as { data?: { status?: string; outputs?: string[]; error?: string } };
    if (pd.data?.status === "completed") {
      const url = pd.data.outputs?.[0];
      if (!url) throw new Error("Seedream completed with no output");
      return url;
    }
    if (pd.data?.status === "failed") throw new Error(pd.data.error ?? "Seedream generation failed");
  }
  throw new Error("Seedream image generation timed out");
}
