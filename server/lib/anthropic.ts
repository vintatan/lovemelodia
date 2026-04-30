import Anthropic from "@anthropic-ai/sdk";
import type { Timepoint } from "./db.js";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a music video director. Transform user inputs into a music production brief and a scene breakdown that is tightly synchronized to the song's lyrical and dramatic arc.
Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation outside the JSON:
{
  "enhancedPrompt": "<2-4 sentence music production prompt using our proprietary technique: specify genre, tempo BPM range, key instruments, emotional arc, production quality>",
  "timepoints": [
    {
      "timestamp": "0:00",
      "label": "Intro",
      "lyricMoment": "<what is happening lyrically/musically at this moment>",
      "sceneDesc": "<photorealistic scene description matching the lyric mood, referencing the character's appearance and theme>",
      "mood": "<single emotional word: melancholic | euphoric | tense | dreamy | triumphant | longing | mysterious | playful>",
      "intensity": "low",
      "visualEffect": "<lighting/fx descriptor e.g. 'soft golden bokeh', 'harsh neon rain', 'slow motion dust particles'>",
      "transition": "fade",
      "transitionDuration": 1.0
    }
  ]
}

Rules for dramatic sync:
- Generate exactly 6 to 8 timepoints for a song of approximately 2 minutes
- First timestamp always "0:00" label "Intro" — low intensity, fade or dissolve
- Last label always "Outro" — low intensity, long fade
- Intensity drives transitions: low=0.8-1.2s dissolve/fade, medium=0.5-0.8s, high=0.3-0.5s wipeleft/wiperight
- Chorus/climax: HIGH intensity, wipeleft or wiperight, transitionDuration ≤ 0.4
- Verse/intro/outro: LOW intensity, dissolve or fade, transitionDuration ≥ 0.8
- Bridge/pre-chorus: MEDIUM intensity, rising visual effect
- Transition field must be one of: dissolve | fade | wipeleft | wiperight | slideright
- No more than 2 consecutive identical transitions
- sceneDesc MUST reference the character's appearance AND the chosen theme aesthetic
- lyricMoment explains the emotional/musical moment in 1 sentence`;

export async function enhanceMusicPrompt(params: {
  genres: string[];
  userDescription: string;
}): Promise<{ enhancedPrompt: string; inputTokens: number; outputTokens: number }> {
  const { genres, userDescription } = params;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: `You are a professional music producer creating engaging Indonesian indie songs.
Transform user input into a clean, safe music generation prompt suitable for all audiences.
Rules:
- Write exactly 2-4 sentences in English (for the music AI model)
- ALWAYS start with "Indonesian language vocals and lyrics," — this is non-negotiable
- Lean toward indie, organic, natural production: acoustic or semi-acoustic textures, warm character, authentic feel — avoid over-polished or overly electronic sounds unless the genre demands it
- Describe genre, tempo (BPM range), key instruments, mood, and production style
- Include Indonesian musical flavors when relevant (gamelan, angklung, keroncong, dangdut)
- Always end with "approximately 2 to 3 minutes in duration"
- Focus ONLY on musical elements: instruments, tempo, key, mood, texture, arrangement
- Use only clean, neutral, family-safe language — no explicit, violent, or sensitive wording
- Avoid subjective claims like "viral", "banger", "powerful" — describe sound objectively
- Do not mention any AI model, tool names, or brand names
Respond with ONLY the prompt text, no explanation or markdown.`,
    messages: [{
      role: "user",
      content: `Genre/vibe: ${genres.length > 0 ? genres.join(", ") : "any"}
User description: ${userDescription || "Create an engaging and memorable Indonesian Gen Z song"}

Write the enhanced music generation prompt.`,
    }],
  });

  const enhancedPrompt = (msg.content[0] as { text: string }).text.trim();
  return { enhancedPrompt, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens };
}

export interface MusicTimepoint {
  timestamp: string;
  label: string;
  description: string;
  mood: string;
}

export async function generateEnhancedPromptWithTimepoints(params: {
  genres: string[];
  userDescription: string;
}): Promise<{
  enhancedPrompt: string;
  timepoints: MusicTimepoint[];
  inputTokens: number;
  outputTokens: number;
}> {
  const { genres, userDescription } = params;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `Kamu adalah music director yang ahli membuat lagu indie Indonesia yang natural dan otentik.
Dari deskripsi vibe pengguna, buat:
1. Enhanced prompt dalam bahasa Inggris (untuk AI music model) — deskripsi musikal yang bersih dan netral
2. Dramatic timepoints dalam bahasa Indonesia — momen struktural lagu yang menarik

Respons HANYA berupa JSON valid (tanpa markdown, tanpa penjelasan lain):
{
  "enhancedPrompt": "2-4 kalimat Inggris: genre, BPM, instrumen, mood, production style. WAJIB diawali dengan 'Indonesian language vocals and lyrics,' dan WAJIB mengandung nuansa indie yang natural dan organik. Diakhiri dengan 'approximately 2 to 3 minutes in duration'",
  "timepoints": [
    {
      "timestamp": "0:00",
      "label": "Intro",
      "description": "deskripsi momen dalam bahasa Indonesia yang relatable",
      "mood": "satu kata: mysterious/melancholic/tense/euphoric/triumphant/dreamy/playful/longing"
    }
  ]
}

Rules:
- 6-8 timepoints untuk lagu ~2 menit
- Timestamp pertama "0:00" label "Intro", terakhir label "Outro"
- enhancedPrompt WAJIB dimulai dengan "Indonesian language vocals and lyrics," — tidak boleh dihilangkan
- Selalu dorong ke arah: indie, akustik/semi-akustik, produksi natural dan hangat, feel otentik — hindari suara over-produced atau terlalu elektronik kecuali genre menuntut itu
- enhancedPrompt: hanya elemen musikal (instrumen, tempo, kunci, mood, tekstur) — tidak ada kata eksplisit, keras, atau sensitif
- Fokus pada audio/musik bukan visual`,
    messages: [{
      role: "user",
      content: `Genre/vibe: ${genres.length > 0 ? genres.join(", ") : "bebas"}
Deskripsi: ${userDescription || "Bikin lagu yang baper dan viral buat Gen Z"}

Buat enhanced prompt + dramatic timepoints.`,
    }],
  });

  const rawText = (msg.content[0] as { text: string }).text.trim();
  let parsed: { enhancedPrompt: string; timepoints: MusicTimepoint[] };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) parsed = JSON.parse(match[1]);
    else throw new Error(`Claude returned non-JSON: ${rawText.slice(0, 200)}`);
  }

  if (!parsed.enhancedPrompt || !Array.isArray(parsed.timepoints)) {
    throw new Error("Claude response missing required fields");
  }

  return {
    enhancedPrompt: parsed.enhancedPrompt,
    timepoints: parsed.timepoints,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  };
}

export interface Stage1Result {
  enhancedPrompt: string;
  timepoints: Timepoint[];
}

export async function enhancePromptAndTimepoints(params: {
  characterDesc: string;
  theme: string;
  musicVibe: string;
  characterImageBase64?: string | null;
}): Promise<{ result: Stage1Result; inputTokens: number; outputTokens: number }> {
  const { characterDesc, theme, musicVibe, characterImageBase64 } = params;

  const userText = `Character Description: ${characterDesc}
Theme: ${theme}
Music Vibe: ${musicVibe}

Generate the enhanced production prompt and 6-8 timepoints with dramatic sync.`;

  const content: Anthropic.MessageParam["content"] = characterImageBase64
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: characterImageBase64 },
        },
        { type: "text", text: userText },
      ]
    : [{ type: "text", text: userText }];

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const rawText = (msg.content[0] as { text: string }).text;

  let parsed: Stage1Result;
  try {
    parsed = JSON.parse(rawText) as Stage1Result;
  } catch {
    // Try extracting JSON from a markdown code block if model wrapped it
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      parsed = JSON.parse(match[1]) as Stage1Result;
    } else {
      throw new Error(`Claude returned non-JSON: ${rawText.slice(0, 200)}`);
    }
  }

  if (!parsed.enhancedPrompt || !Array.isArray(parsed.timepoints)) {
    throw new Error("Claude response missing required fields");
  }

  return {
    result: parsed,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  };
}

export async function generateCharacterDescription(params: {
  songTitle: string | null;
  songDescription: string;
  enhancedMusicPrompt: string;
  genres: string[];
}): Promise<string> {
  const { songTitle, songDescription, enhancedMusicPrompt, genres } = params;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: `You are a character designer for music video storyboards.
Create a single concise portrait prompt for an AI image generator.
The character must visually reflect the song's theme, mood, and story — not just the music genre.
Rules:
- One paragraph, max 60 words
- Describe a specific Indonesian person whose look, outfit, and expression embody the song's narrative
- Include: age range, gender, distinctive features, outfit that fits the song's theme, emotional expression
- Style: photorealistic portrait, natural lighting, sharp focus, beautiful, 8k
- No violence, no explicit content
- Output ONLY the prompt text, nothing else`,
    messages: [{
      role: "user",
      content: `Song title: ${songTitle ?? "(untitled)"}
Song theme/description: ${songDescription}
Music production style: ${enhancedMusicPrompt}
Genres: ${genres.length > 0 ? genres.join(", ") : "indie"}`,
    }],
  });

  return (msg.content[0] as { text: string }).text.trim();
}

export async function generateStoryboardImagePrompts(params: {
  songTitle: string | null;
  songDescription: string;
  enhancedMusicPrompt: string;
  timepoints: Array<{ timestamp: string; label: string; description: string; mood: string }>;
  genres: string[];
}): Promise<{ prompts: string[]; inputTokens: number; outputTokens: number }> {
  const { songTitle, songDescription, enhancedMusicPrompt, timepoints, genres } = params;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are a cinematic storyboard director for music videos.
Translate each scene description into an English image prompt that is VISUALLY TIED to the song's specific theme, title, and narrative.
Every prompt must feel like it belongs to THIS song — not a generic music video.
Each prompt must be: photorealistic, beautiful, high quality, cinematic, 8k, sharp focus, atmospheric, emotionally resonant.
Always include: specific lighting (golden hour / neon / moonlight etc), color grade, depth of field, location relevant to the song's story.
The main character will be composited in via reference — describe ENVIRONMENT and MOOD, not the character's face.
Safe, clean content only. Landscape 16:9 widescreen composition.
Respond ONLY with valid JSON: { "prompts": ["prompt1", "prompt2", ...] }`,
    messages: [{
      role: "user",
      content: `Song title: ${songTitle ?? "(untitled)"}
Song theme/description: ${songDescription}
Music production style: ${enhancedMusicPrompt}
${genres.length > 0 ? `Genres: ${genres.join(", ")}` : ""}

Timepoints:
${timepoints.map((tp, i) => `${i + 1}. [${tp.timestamp}] ${tp.label} (${tp.mood}): ${tp.description}`).join("\n")}

Generate one English cinematic image prompt per timepoint. Each scene must visually reflect the song's title and theme. Landscape widescreen, photorealistic, beautiful, cinematic lighting, 8k.`,
    }],
  });

  const rawText = (msg.content[0] as { text: string }).text.trim();
  let parsed: { prompts: string[] };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) parsed = JSON.parse(match[1]);
    else throw new Error(`Claude returned non-JSON for storyboard prompts: ${rawText.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed.prompts)) throw new Error("Claude response missing prompts array");

  return {
    prompts: parsed.prompts,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  };
}
