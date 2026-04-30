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
    system: `You are a professional music producer creating viral Indonesian Gen Z bangers.
Transform user input into a music generation prompt that produces a viral, emotionally powerful song.
Rules:
- Write exactly 2-4 sentences in English (for the music AI model)
- Optimize for viral Gen Z appeal: catchy hooks, emotional peak moments, trendy production
- Specify genre, tempo (BPM range), key instruments, emotional arc, production quality
- Include Indonesian musical flavors when relevant (gamelan textures, dangdut rhythm, keroncong, etc.)
- Always end with "approximately 2 to 3 minutes in duration"
- Focus ONLY on music and sound — no visual or video descriptions
- Do not mention any AI model or tool names
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
    system: `Kamu adalah music director yang ahli bikin lagu viral buat Gen Z Indonesia.
Dari deskripsi vibe pengguna, buat:
1. Enhanced prompt dalam bahasa Inggris (untuk AI music model) — fokus pada Gen Z viral sound
2. Dramatic timepoints dalam bahasa Indonesia — momen emosional yang bikin lagu terasa epic

Respons HANYA berupa JSON valid (tanpa markdown, tanpa penjelasan lain):
{
  "enhancedPrompt": "2-4 kalimat Inggris: genre, BPM, instrumen, mood, production style. Diakhiri dengan 'approximately 2 to 3 minutes in duration'",
  "timepoints": [
    {
      "timestamp": "0:00",
      "label": "Intro",
      "description": "deskripsi momen dalam bahasa Indonesia Gen Z yang vivid dan emosional",
      "mood": "satu kata: mysterious/melancholic/tense/euphoric/triumphant/dreamy/playful/longing"
    }
  ]
}

Rules timepoints:
- 6-8 timepoints untuk lagu ~2 menit
- Timestamp pertama "0:00" label "Intro", terakhir label "Outro"
- Bahasa Indonesia Gen Z yang relatable dan emosional
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
