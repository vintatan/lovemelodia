# Phase m2.3 — Story Interview

Conversational lyric builder. Before music generation, a bot asks 3–5 emotionally touching questions based on the occasion. User answers become the foundation for personalized lyrics via Claude.

---

## Acceptance Criteria

- After occasion selection, user sees a "Cerita dulu..." (Tell us the story) screen instead of raw prompt
- Questions appear one at a time with typing animation, warm conversational tone
- Each answer is saved; progress shown (e.g., "2 dari 4 pertanyaan")
- After all questions: "Bikin Lagu dari Ceritamu 🎵" button
- POST /api/music/build-story accepts `{ occasion, answers[] }` → Claude Sonnet generates `{ enhancedPrompt, lyricHints }` → used as input for Lyria generation
- User can skip story and go straight to manual prompt ("Tulis sendiri →" small link)

---

## Question Sets by Occasion

### Birthday
1. "Apa pencapaian terbesar orang ini yang kamu paling bangga?"
2. "Ceritain satu momen lucu atau tak terlupakan bersama dia."
3. "Kalau bisa kasih satu kalimat semangat buat dia, apa yang mau kamu bilang?"

### Mother
1. "Apa kenangan paling berkesan yang kamu punya bersama ibumu?"
2. "Kalimat atau nasihat ibu yang selalu kamu ingat sampai sekarang?"
3. "Momen apa yang paling bikin kamu merasa ibumu benar-benar ada buat kamu?"
4. "Kalau bisa bilang satu hal ke ibu sekarang, apa itu?"

### Lover
1. "Ceritain momen pertama kamu sadar kamu jatuh cinta sama dia."
2. "Apa hal terkecil yang dia lakuin yang selalu bikin kamu senyum sendiri?"
3. "Ada tempat, lagu, atau momen yang selalu mengingatkanmu sama dia?"
4. "Apa yang kamu harap dia tahu tentang perasaan kamu?"

### Friendship
1. "Apa kenangan paling lucu atau paling berkesan kalian berdua?"
2. "Momen apa yang bikin kamu sadar dia adalah sahabat sejati?"
3. "Apa yang paling kamu syukuri dari persahabatan ini?"

### Anniversary
1. "Ceritain momen di perjalanan kalian yang paling kamu syukuri."
2. "Apa yang berubah dalam dirimu karena dia ada?"
3. "Mimpi atau rencana apa yang masih ingin kalian wujudkan bersama?"

### Graduation
1. "Apa perjuangan terbesar yang dia lalui untuk sampai di titik ini?"
2. "Momen apa yang bikin kamu paling bangga sama dia selama prosesnya?"
3. "Pesan apa yang ingin kamu kirimkan untuk perjalanan berikutnya?"

### Other Occasions (wedding, father, gratitude, ramadan, christmas)
Generate 3 questions each with similar emotional depth.

---

## Implementation

### New Component: `src/components/music/StoryInterview.tsx`

Props:
```ts
{ occasion: string; onComplete: (answers: string[]) => void; onSkip: () => void }
```

State:
- `currentQ` — index of current question
- `answers` — string array accumulating user responses
- `inputValue` — controlled textarea value
- `isTyping` — boolean for question typing animation

Behavior:
- Question appears with typing animation (character by character, 30ms delay)
- Large textarea for answer (min 3 chars to enable proceeding)
- "Lanjut →" button advances to next question
- Progress bar at top showing e.g. "2 dari 4 pertanyaan"
- Warm visual tone: cream/amber background, serif font for questions
- Last question: button label changes to "Bikin Lagu dari Ceritamu 🎵"
- Small "Tulis sendiri →" link at bottom for skip

---

### New Server Endpoint: `server/routes/music.ts`

```
POST /api/music/build-story
Auth: required
Body: { occasion: string, answers: string[], recipientName?: string }
```

Claude Sonnet prompt:

**System:**
> "You are a lyric writer for personalized gift songs. Given someone's real memories and feelings about a loved one, create an emotionally resonant music generation prompt and 3-4 lyric themes. Write in Indonesian. Be specific, emotional, and avoid generic phrases. Use the actual details from their stories."

**User:**
> "Occasion: {occasion}\nStories:\n{answers.map((a,i) => `${i+1}. ${a}`).join('\n')}\n\nGenerate: 1) A music production prompt (2-3 sentences, describe genre, mood, instrumentation), 2) 3-4 lyric themes (specific lines or images from their stories)"

**Returns:** `{ enhancedPrompt: string, lyricHints: string[] }`

The `enhancedPrompt` is passed directly to `/api/music/generate` as the `prompt` field.

---

### Wire into MusicCreator.tsx

- After occasion selection → show `<StoryInterview />` as full-screen takeover with smooth transition
- On complete: call `/api/music/build-story`, set `enhancedPrompt` from response → proceed immediately to generating phase (no raw prompt shown to user)
- On skip: show raw prompt textarea as fallback
