# Phase M2.1 — Simplified Music Generation (Lyria 3 Pro)

## Goal
Port Lyria 3 Pro music generation from kreasi-ai and simplify it for the gift context.
The creator picks an occasion, the system fills a prompt, and one button produces a song.
No multi-step enhance-prompt flow. No genre picker. Just occasion → music.

---

## Background: kreasi-ai Music Flow

In kreasi-ai, music generation is a 2-step flow:
1. User enters free-text prompt + picks genres → calls `POST /api/music/enhance-prompt`
   (Claude generates an enhanced prompt with timepoints).
2. User approves enhanced prompt → calls `POST /api/music/generate` with the enhanced prompt.

For Lovemelodia, both steps collapse into one: the occasion maps to a fixed prompt
which is passed directly as `enhancedPrompt`, skipping the Claude enhance step entirely.

---

## Backend Changes

### `server/routes/music.ts`

**No structural changes required.** The existing `POST /api/music/generate` route
accepts `{ prompt, enhancedPrompt }` — passing `enhancedPrompt` bypasses the
internal Claude call (see line 86 in kreasi-ai's music.ts: `if (!enhancedPrompt) { ... }`).

Confirm that credit cost is updated:
```ts
const MUSIC_CREDITS = 1; // was 20 in kreasi-ai
```

This is the key change — 1 credit per generation, not 20.

---

## Frontend Changes

### `src/components/music/MusicCreator.tsx`

**Complete UI simplification.** Preserve the underlying API call pattern and
AudioPlayer component. Remove:
- Genre chips (`GENRES`, `GENRE_DEFAULTS`)
- Free-text prompt textarea
- "Perkuat Prompt" (enhance-prompt) button and enhanced-prompt display panel
- Timepoints/lyrics display

**Replace with:**

#### Occasion Selector (Step 1)
12 occasion tiles in a 3-col grid (4-col on desktop). Each tile: large emoji + label.

| Occasion ID | Label | Emoji | Prompt |
|-------------|-------|-------|--------|
| `birthday` | Ulang Tahun | 🎂 | "Upbeat birthday song with warm celebratory feeling, joyful and personal, energetic pop style" |
| `lover` | Untuk Kekasih | 💕 | "Romantic ballad with tender emotional depth, intimate and heartfelt, soft piano and strings" |
| `mother` | Untuk Ibu | 🌸 | "Warm nurturing melody with gratitude and deep love, gentle and emotional, acoustic guitar" |
| `friendship` | Persahabatan | 🤝 | "Uplifting song about bonds and shared memories, nostalgic and joyful, indie pop feel" |
| `anniversary` | Anniversary | 💍 | "Elegant romantic piece with timeless quality, sophisticated and loving, orchestral pop" |
| `father` | Untuk Ayah | 👨 | "Strong yet tender melody expressing gratitude and admiration, warm acoustic folk" |
| `graduation` | Wisuda | 🎓 | "Triumphant celebratory melody with hope and new beginnings, cinematic and uplifting" |
| `wedding` | Pernikahan | 💒 | "Beautiful wedding ballad with eternal love theme, orchestral and deeply emotional" |
| `gratitude` | Terima Kasih | 🙏 | "Heartfelt gratitude song with warmth and sincerity, gentle acoustic and vocal" |
| `ramadan` | Ramadan | 🌙 | "Spiritual and peaceful Ramadan melody with reverence and community warmth, soft and devotional" |
| `christmas` | Natal | 🎄 | "Joyful Christmas song with warmth and family feeling, festive and heartwarming" |
| `custom` | Bebas | ✨ | "" (show textarea for custom description — 120 chars max) |

- Selected tile gets a highlighted ring (burgundy border + soft glow).
- "Bebas" tile expands a small textarea beneath the grid for custom input.

#### Generate Button (Step 2)
Single CTA: `"Bikin Lagu 🎵"` — disabled until an occasion is selected.

On click:
1. Check credits (show CreditsModal if 0).
2. Deduct confirmed by server response.
3. POST `/api/music/generate` with:
   ```json
   {
     "prompt": "<occasion label>",
     "enhancedPrompt": "<occasion prompt from table above>",
     "title": "<occasion label> — Lovemelodia"
   }
   ```
4. Poll `/api/music/status/:jobId` every 3s (same pattern as kreasi-ai).

#### Loading State
Reuse `MUSIC_LOADING_MSGS` pattern but with gift-centric copy:
```ts
const GIFT_LOADING_MSGS = [
  "AI lagi bikin lagunya untukmu... 🎵",
  "Merangkai melodi yang tepat...",
  "Nuansin emosi di setiap nada...",
  "Hampir jadi, sebentar lagi! 🎁",
  "Finishing touches...",
];
```

#### Done State (after audio ready)
- Show `AudioPlayer` with the generated track.
- Show track title.
- Show two buttons:
  - `"🔄 Bikin Ulang"` — resets to occasion selector (no credit charge, new generation deducts).
  - `"Buat Gift Card 🎁"` — renders a `<GiftCardCreator />` placeholder with text
    "Gift card coming soon in M3!" (GiftCardCreator not built yet in M2).
- Credits remaining badge updates.

---

## State Machine

```
idle → selecting_occasion → generating → done | failed
```

- `idle`: show occasion grid, button disabled
- `selecting_occasion`: occasion selected, button enabled
- `generating`: spinner + rotating loading messages
- `done`: AudioPlayer + action buttons
- `failed`: error message + "Coba lagi" resets to `idle`

---

## Files Touched

| File | Change type |
|------|-------------|
| `server/routes/music.ts` | Edit — change `MUSIC_CREDITS` from 20 to 1 |
| `src/components/music/MusicCreator.tsx` | Rewrite UI — replace genre/prompt/enhance with occasion selector |

---

## Acceptance Criteria
- [ ] Selecting an occasion enables the generate button.
- [ ] "Bebas" occasion shows custom textarea (120 char max).
- [ ] Clicking "Bikin Lagu" deducts exactly 1 credit.
- [ ] Loading state shows rotating gift-centric messages.
- [ ] Completed track appears in AudioPlayer.
- [ ] Credits badge updates after generation.
- [ ] Failed generation refunds 1 credit (existing refund logic in music.ts).
- [ ] "Bikin Ulang" resets to occasion selector without charging.
