import Anthropic from "@anthropic-ai/sdk";
import type { Timepoint } from "./db.js";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a music video director. Transform user inputs into a music production brief and a scene breakdown that is tightly synchronized to the song's lyrical and dramatic arc.
Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation outside the JSON:
{
  "enhancedPrompt": "<2-4 sentence music production prompt for Lyria 3 Pro: specify genre, tempo BPM range, key instruments, emotional arc, production quality>",
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
