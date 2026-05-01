import Anthropic from "@anthropic-ai/sdk";
import type { Timepoint } from "./db.js";

const client = new Anthropic();

function escapeNewlinesInStrings(s: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { result += c; escaped = false; continue; }
    if (c === "\\") { result += c; escaped = true; continue; }
    if (c === '"') { inString = !inString; result += c; continue; }
    if (inString && (c === "\n" || c === "\r")) { result += "\\n"; continue; }
    result += c;
  }
  return result;
}

function parseClaudeJson<T>(rawText: string, context: string): T {
  try { return JSON.parse(rawText) as T; } catch { /* fall through */ }
  const blockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blockMatch) { try { return JSON.parse(blockMatch[1]) as T; } catch { /* fall through */ } }
  const braceMatch = rawText.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]) as T; } catch { /* fall through */ } }
  // Last resort: Claude may emit literal newlines inside JSON string values (common with multi-line lyrics)
  const sanitized = escapeNewlinesInStrings(rawText);
  try { return JSON.parse(sanitized) as T; } catch { /* fall through */ }
  const sanitizedBlock = blockMatch ? escapeNewlinesInStrings(blockMatch[1]) : null;
  if (sanitizedBlock) { try { return JSON.parse(sanitizedBlock) as T; } catch { /* fall through */ } }
  const sanitizedBrace = braceMatch ? escapeNewlinesInStrings(braceMatch[0]) : null;
  if (sanitizedBrace) { try { return JSON.parse(sanitizedBrace) as T; } catch { /* fall through */ } }
  throw new Error(`${context}: ${rawText.slice(0, 200)}`);
}

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
  title: string;
  enhancedPrompt: string;
  lyrics: string;
  timepoints: MusicTimepoint[];
  inputTokens: number;
  outputTokens: number;
}> {
  const { genres, userDescription } = params;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `Kamu adalah music director dan penulis lagu yang ahli membuat lagu indie Indonesia yang natural dan otentik.
Dari deskripsi vibe pengguna, buat:
1. Enhanced prompt dalam bahasa Inggris (untuk AI music model) — deskripsi musikal yang bersih dan netral
2. Lirik lagu lengkap dalam Bahasa Indonesia — 2-3 verse, chorus, dan outro
3. Dramatic timepoints dalam bahasa Indonesia — momen struktural lagu yang menarik

Respons HANYA berupa JSON valid (tanpa markdown, tanpa penjelasan lain):
{
  "title": "Judul lagu dalam Bahasa Indonesia — singkat, puitis, max 6 kata, tanpa tanda kutip",
  "enhancedPrompt": "2-4 kalimat Inggris: genre, BPM, instrumen, mood, production style. WAJIB diawali dengan 'Indonesian language vocals and lyrics,' dan WAJIB mengandung nuansa indie yang natural dan organik. Diakhiri dengan 'approximately 2 to 3 minutes in duration'",
  "lyrics": "[Verse 1]\\n...\\n\\n[Pre-Chorus]\\n...\\n\\n[Chorus]\\n...\\n\\n[Verse 2]\\n...\\n\\n[Chorus]\\n...\\n\\n[Outro]\\n...",
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
- Lirik HARUS mencerminkan perspektif pencerita yang jelas: jika tema cinta dari sudut pandang perempuan, gunakan "aku" perempuan; jika laki-laki, gunakan "aku" laki-laki
- Lirik harus original, relatable untuk Gen Z Indonesia, bersih dan aman untuk semua umur
- Fokus pada audio/musik bukan visual untuk enhancedPrompt`,
    messages: [{
      role: "user",
      content: `Genre/vibe: ${genres.length > 0 ? genres.join(", ") : "bebas"}
Deskripsi: ${userDescription || "Bikin lagu yang baper dan viral buat Gen Z"}

Buat enhanced prompt + lirik lengkap + dramatic timepoints.`,
    }],
  });

  const rawText = (msg.content[0] as { text: string }).text.trim();
  const parsed = parseClaudeJson<{ title?: string; enhancedPrompt: string; lyrics: string; timepoints: MusicTimepoint[] }>(rawText, "Claude returned non-JSON");

  if (!parsed.enhancedPrompt || !Array.isArray(parsed.timepoints)) {
    throw new Error("Claude response missing required fields");
  }

  return {
    title: parsed.title?.trim() ?? "",
    enhancedPrompt: parsed.enhancedPrompt,
    lyrics: parsed.lyrics ?? "",
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
  const parsed = parseClaudeJson<Stage1Result>(rawText, "Claude returned non-JSON");

  if (!parsed.enhancedPrompt || !Array.isArray(parsed.timepoints)) {
    throw new Error("Claude response missing required fields");
  }

  return {
    result: parsed,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  };
}

export interface SongUnderstanding {
  singerGender: "female" | "male" | "neutral";
  characterPortraitPrompt: string;
  keyVisuals: string[];
  setting: string;
  coreTheme: string;
}

export async function generateSongUnderstanding(params: {
  songTitle: string | null;
  songDescription: string;
  enhancedMusicPrompt: string;
  timepoints: Array<{ timestamp: string; label: string; description: string; mood: string }>;
  lyrics?: string | null;
}): Promise<SongUnderstanding> {
  const { songTitle, songDescription, enhancedMusicPrompt, timepoints, lyrics } = params;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: `You are a music video creative director. Analyze a song to extract visual and narrative intelligence that drives image generation.
Read ALL available information (title, description, production notes, lyrics, timepoints) to deeply understand the song.
Respond ONLY with valid JSON — no markdown, no explanation:
{
  "singerGender": "female OR male OR neutral",
  "characterPortraitPrompt": "max 70 words. Attractive Indonesian [gender], 20s, striking features (smooth skin, expressive eyes, defined jawline or soft feminine face). Outfit, hair, and makeup pulled directly from the song's world and emotional tone. Emotional expression that mirrors the song's core feeling. Photorealistic portrait, soft cinematic lighting, shallow depth of field, beautiful, editorial quality, 8k. MUST state gender explicitly.",
  "keyVisuals": ["3-5 concrete visual elements pulled from the lyrics/narrative — specific objects, locations, actions"],
  "setting": "specific primary environment (e.g. 'rain-soaked Jakarta rooftop at 3am', not just 'city')",
  "coreTheme": "one sentence: what this song is fundamentally about"
}

Rules:
- singerGender: infer from lyric pronouns, emotional perspective, and narrative voice. Indonesian lyrics: check for feminine/masculine framing.
- characterPortraitPrompt: reflect the song's specific world. Pull appearance details (outfit, hair, expression) directly from lyric imagery. The character must feel like they belong in this song's universe — not generic. Always attractive and visually compelling.
- keyVisuals: be concrete and specific — pull from lyric metaphors, objects, places, and actions named in the song.
- setting: be evocative and specific, matching the emotional geography of the song.
CONTENT SAFETY — ABSOLUTE RULES (never break these):
- NO sexual content, nudity, revealing clothing, suggestive poses, or romantic/physical intimacy
- NO violence, weapons, blood, gore, or threatening imagery
- NO dark, disturbing, horror, or explicit content of any kind
- All output must be safe for all ages and suitable for general audiences`,
    messages: [{
      role: "user",
      content: `Song title: ${songTitle ?? "(untitled)"}
Song description: ${songDescription}
Production style: ${enhancedMusicPrompt}${lyrics ? `\n\nLyrics:\n${lyrics}` : ""}

Timepoints:
${timepoints.map((tp, i) => `${i + 1}. [${tp.timestamp}] ${tp.label} (${tp.mood}): ${tp.description}`).join("\n")}`,
    }],
  });

  const rawText = (msg.content[0] as { text: string }).text.trim();
  const parsed = parseClaudeJson<SongUnderstanding>(rawText, "generateSongUnderstanding returned non-JSON");
  return {
    singerGender: parsed.singerGender ?? "female",
    characterPortraitPrompt: parsed.characterPortraitPrompt ?? "photorealistic portrait of an attractive young Indonesian woman, 20s, striking features, expressive eyes, soft cinematic lighting, shallow depth of field, beautiful, editorial quality, 8k",
    keyVisuals: Array.isArray(parsed.keyVisuals) ? parsed.keyVisuals : [],
    setting: parsed.setting ?? "",
    coreTheme: parsed.coreTheme ?? "",
  };
}

export async function generateCharacterDescription(params: {
  songTitle: string | null;
  songDescription: string;
  enhancedMusicPrompt: string;
  genres: string[];
  lyrics?: string | null;
}): Promise<string> {
  const { songTitle, songDescription, enhancedMusicPrompt, genres, lyrics } = params;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: `You are a character designer for music video storyboards.
Create a single concise portrait prompt for an AI image generator.
The character must visually reflect the song's theme, mood, and story — not just the music genre.
Rules:
- One paragraph, max 60 words
- CRITICAL: Read the lyrics carefully to identify the narrator's gender. If female, character MUST be female. If male, MUST be male.
- Describe a specific attractive Indonesian person whose look, outfit, and expression embody the song's narrative
- Include: age range, EXPLICIT gender (e.g. "young woman" or "young man"), distinctive features, fully-clothed outfit that fits the song's theme, emotional expression
- Style: photorealistic portrait, natural lighting, sharp focus, beautiful, editorial quality, 8k
- Output ONLY the prompt text, nothing else
CONTENT SAFETY — ABSOLUTE RULES:
- NO sexual content, nudity, revealing or skimpy clothing, cleavage, suggestive poses
- NO violence, weapons, blood, gore, or threatening imagery
- NO dark, disturbing, horror, or explicit content
- Characters must be fully clothed in appropriate, tasteful outfits
- All output safe for all ages`,
    messages: [{
      role: "user",
      content: `Song title: ${songTitle ?? "(untitled)"}
Song theme/description: ${songDescription}
Music production style: ${enhancedMusicPrompt}
Genres: ${genres.length > 0 ? genres.join(", ") : "indie"}${lyrics ? `\n\nLyrics:\n${lyrics}` : ""}

Read the lyrics to determine the narrator's gender, then generate the character portrait.`,
    }],
  });

  return (msg.content[0] as { text: string }).text.trim();
}

export interface AlbumSongConcept {
  title: string;
  genre: string;
  description: string;
}

export async function generateAlbumSongConcepts(theme: string, count: number): Promise<{
  concepts: AlbumSongConcept[];
  coverPrompt: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1536,
    system: `Kamu adalah music director yang kreatif. Buat ${count} konsep lagu yang unik dan berbeda untuk sebuah album bertema, PLUS satu image prompt untuk sampul albumnya.
Respons HANYA berupa JSON valid (tanpa markdown):
{
  "coverPrompt": "50-80 kata dalam Bahasa Inggris — deskripsi visual sinematik untuk sampul album. Harus: abstrak atau simbolik (bukan wajah manusia), evocative dari mood tema, kaya warna dan tekstur, gaya art direction yang kuat (bisa surrealis, dreamlike, painterly, atau fotorealistik). JANGAN sebut teks, huruf, atau tipografi.",
  "songs": [
    {
      "title": "Judul lagu dalam Bahasa Indonesia — puitis, max 5 kata",
      "genre": "satu genre: Pop | Electronic | Jazz | Tradisional | Rock | Cinematic | R&B | Lo-fi",
      "description": "2-3 kalimat Bahasa Indonesia: sudut pandang spesifik dari tema, mood, dan cerita yang akan diangkat lagu ini"
    }
  ]
}
Pastikan setiap lagu berbeda genre/mood, dan bersama-sama membentuk album yang koheren dengan tema.`,
    messages: [{
      role: "user",
      content: `Tema album: ${theme}\nBuat ${count} konsep lagu yang beragam dan satu cover prompt untuk album ini.`,
    }],
  });

  const rawText = (msg.content[0] as { text: string }).text.trim();
  const parsed = parseClaudeJson<{ coverPrompt?: string; songs?: AlbumSongConcept[] }>(rawText, "generateAlbumSongConcepts returned non-JSON");

  const songs = Array.isArray(parsed.songs) ? parsed.songs : (Array.isArray(parsed) ? parsed as unknown as AlbumSongConcept[] : []);
  if (songs.length === 0) throw new Error("Claude returned no song concepts");

  return {
    concepts: songs.slice(0, count),
    coverPrompt: parsed.coverPrompt ?? `${theme}, abstract artistic album cover, cinematic mood, rich colors, evocative and symbolic visual`,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  };
}

export async function generateStoryboardImagePrompts(params: {
  songTitle: string | null;
  songDescription: string;
  enhancedMusicPrompt: string;
  timepoints: Array<{ timestamp: string; label: string; description: string; mood: string }>;
  genres: string[];
  lyrics?: string | null;
  songUnderstanding?: SongUnderstanding | null;
}): Promise<{ prompts: string[]; inputTokens: number; outputTokens: number }> {
  const { songTitle, songDescription, enhancedMusicPrompt, timepoints, genres, lyrics, songUnderstanding } = params;

  const understandingBlock = songUnderstanding
    ? `\nSong understanding:\n- Theme: ${songUnderstanding.coreTheme}\n- Setting: ${songUnderstanding.setting}\n- Key visuals from song: ${songUnderstanding.keyVisuals.join(", ")}`
    : "";

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `You are a surrealist music video director. Translate each lyric moment into a stunning, photorealistic image prompt.

Rules:
- Landscape 16:9 cinematic widescreen composition
- Each prompt must be a beautiful, surreal, emotionally resonant scene DIRECTLY inspired by the lyrics at that exact moment
- Ground scenes in concrete lyric imagery: specific objects, places, metaphors, and actions named in the song
- Character may appear loosely — as silhouette, back view, partial figure, or purely atmospheric presence — never the main focus
- Emphasize: dramatic lighting, rich color palette, visual poetry, depth of field, surreal or dreamlike elements that mirror the emotional tone
- Max 80 words per prompt
CONTENT SAFETY — ABSOLUTE RULES (never break these, no exceptions):
- NO sexual content, nudity, revealing clothing, suggestive or intimate scenes
- NO violence, weapons, blood, gore, fighting, or threatening imagery
- NO dark, disturbing, horror, scary, or psychologically distressing imagery
- NO alcohol, drugs, or illegal activity
- All scenes must be wholesome, positive, and suitable for all ages
Respond ONLY with valid JSON: { "prompts": ["prompt1", "prompt2", ...] }`,
    messages: [{
      role: "user",
      content: `Song title: ${songTitle ?? "(untitled)"}
Song description: ${songDescription}
Production style: ${enhancedMusicPrompt}
${genres.length > 0 ? `Genres: ${genres.join(", ")}` : ""}${understandingBlock}${lyrics ? `\n\nLyrics:\n${lyrics}` : ""}

Timepoints:
${timepoints.map((tp, i) => `${i + 1}. [${tp.timestamp}] ${tp.label} (${tp.mood}): ${tp.description}`).join("\n")}

Generate one English image prompt per timepoint. Each scene must be a visual poem for that lyric moment — surreal, beautiful, cinematic. Ground every image in the song's specific imagery and emotional world.`,
    }],
  });

  const rawText = (msg.content[0] as { text: string }).text.trim();
  const parsed = parseClaudeJson<{ prompts: string[] }>(rawText, "Claude returned non-JSON for storyboard prompts");

  if (!Array.isArray(parsed.prompts)) throw new Error("Claude response missing prompts array");

  return {
    prompts: parsed.prompts,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  };
}
