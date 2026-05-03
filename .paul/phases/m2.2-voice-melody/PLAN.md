# Phase M2.2 — Voice/Humming Melody Input (WaveSpeed LeVo)

## Goal
Allow users to hum or sing a melody into the browser, upload the recording, and use
WaveSpeed's Song Generation (LeVo) API to produce a full track based on their melody.
This is the second input mode in MusicCreator, alongside the occasion-based text flow.

---

## New File: `server/lib/levodance.ts`

WaveSpeed Song Generation endpoint. Same submit-then-poll pattern as `lyria.ts`.

```ts
// POST https://api.wavespeed.ai/api/v3/wavespeed-ai/song-generation
// Body: { prompt, lyric?, prompt_audio, duration }
// Response: { data: { id: string } }  → poll for completion

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";

interface LeVoRequest {
  prompt: string;      // style/mood description
  lyric?: string;      // optional lyric text
  prompt_audio: string; // public URL of uploaded audio
  duration: number;    // seconds, max 30
}

interface LeVoJobResult {
  audioUrl: string;
}

export async function generateFromMelody(req: LeVoRequest): Promise<LeVoJobResult> {
  // Step 1: Submit job
  // POST /wavespeed-ai/song-generation with Authorization: Bearer WAVESPEED_API_KEY
  // → { data: { id } }

  // Step 2: Poll /results/{id} every 3s until status "completed" or "failed"
  // Timeout after 3 minutes (60 polls)
  // On completed: return { audioUrl: data.outputs[0] }
}
```

Error handling:
- If WaveSpeed returns `status: "failed"`, throw with `data.error` message.
- If polling times out, throw `"Generasi timeout — coba lagi"`.
- Log cost via `logCost()` — estimate $0.08 per 30s generation.

---

## Backend Routes (additions to `server/routes/music.ts`)

### `POST /api/music/upload-recording`

Accepts `multipart/form-data` with field `recording` (audio file).

```ts
router.post("/upload-recording", upload.single("recording"), async (req, res) => {
  // 1. Validate: file present, size < 5MB, mimetype audio/*
  // 2. Upload buffer to GCS: recordings/{phone}/{nanoid()}.{ext}
  //    - webm for Chrome/Firefox/Android
  //    - mp4 for iOS Safari (audio/mp4 or audio/x-m4a)
  // 3. Return { recordingUrl: "https://storage.googleapis.com/..." }
});
```

Multer config for this route: `memoryStorage`, limits `{ fileSize: 5 * 1024 * 1024 }`.

GCS path: `recordings/{phone}/{nanoid()}.{ext}` where ext is derived from mimetype:
- `audio/webm` → `.webm`
- `audio/mp4`, `audio/x-m4a`, `audio/mpeg` → `.mp4`
- fallback → `.bin`

### `POST /api/music/generate-from-melody`

```ts
router.post("/generate-from-melody", async (req, res) => {
  const { recordingUrl, occasion } = req.body;
  // 1. Validate recordingUrl (must be GCS URL from our bucket)
  // 2. Deduct 1 credit (same deductCreditsAsync pattern as /generate)
  // 3. Look up occasion prompt from OCCASION_PROMPTS map (same as M2.1)
  // 4. Create music_job row: createMusicJob(jobId, phone, occasion, title, occasionPrompt)
  // 5. Return 202 { jobId, creditsRemaining } immediately
  // 6. Async: call generateFromMelody({ prompt: occasionPrompt, prompt_audio: recordingUrl, duration: 30 })
  //           → updateMusicJob(jobId, "completed", audioUrl)
  //    On error: updateMusicJob(jobId, "failed", ...) + addCreditsAsync refund
});
```

Status polling reuses the existing `GET /api/music/status/:jobId` — no new route needed.

---

## Frontend: `src/components/music/MusicCreator.tsx`

### Tab Toggle (above the main content area)

Two tabs, pill-style:
```
[ ✍️ Tulis Momen ]  [ 🎤 Rekam Nada ]
```
- Active tab: filled burgundy background, white text.
- Inactive: transparent, muted text.
- Switching tabs preserves occasion selection (shared state).

### VoiceRecorder Component (new, inline or extracted)

**UI States:**

1. **Idle** — large circular record button (burgundy), microphone icon.
   - Caption: "Nyanyikan atau bersenandung melodinya"
   - Sub: "Maks. 30 detik"

2. **Permission prompt** — if `getUserMedia` permission denied, show:
   - "Izinkan akses mikrofon untuk merekam nada"
   - "Buka pengaturan" link → `navigator.mediaDevices.getUserMedia` re-prompt.

3. **Recording** — button turns red with pulsing ring.
   - Countdown timer: `30 — elapsed` seconds, displayed prominently.
   - Waveform visualizer: 32 vertical bars, heights driven by `AnalyserNode.getByteFrequencyData()`.
     - Bar color: `#9B2335` (Lovemelodia burgundy).
     - Bar width: 6px, gap: 3px, max height: 60px.
     - Container: `w-full h-16 flex items-end justify-center gap-[3px]`.
     - Animation: `requestAnimationFrame` loop updating bar heights.
   - Auto-stop at 30s.

4. **Recorded** — show playback preview (HTML `<audio>` element with controls).
   - Two actions:
     - `"🔄 Rekam Ulang"` — discards blob, returns to Idle.
     - `"Gas Bikin dari Nada Ini 🎵"` — uploads then triggers generation.

5. **Uploading** — spinner, "Mengunggah rekaman..."

6. **Generating** — same rotating messages as Tulis tab.

**MediaRecorder Implementation:**

```ts
// mimeType fallback chain
const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
  ? "audio/webm;codecs=opus"
  : MediaRecorder.isTypeSupported("audio/mp4")
  ? "audio/mp4"
  : "audio/webm";

const recorder = new MediaRecorder(stream, { mimeType });
```

Collect chunks into a `Blob`, then `URL.createObjectURL(blob)` for preview.

**Upload flow:**
```ts
const formData = new FormData();
formData.append("recording", blob, `melody.${ext}`); // ext from mimeType
const { recordingUrl } = await apiFetch("POST", "/api/music/upload-recording", formData);
// then POST /api/music/generate-from-melody with { recordingUrl, occasion }
```

**iOS note:** iOS Safari only supports `audio/mp4`. The mimeType fallback above handles this.
No special code branch needed, but add a comment explaining the fallback.

---

## Files Touched

| File | Change type |
|------|-------------|
| `server/lib/levodance.ts` | New — WaveSpeed Song Generation client |
| `server/routes/music.ts` | Edit — add 2 new routes (upload-recording, generate-from-melody) |
| `src/components/music/MusicCreator.tsx` | Edit — add tab toggle + VoiceRecorder component |

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `WAVESPEED_API_KEY` | Already present for Lyria — reused |

---

## Acceptance Criteria
- [ ] Chrome/Firefox: record button captures audio as webm, waveform animates during recording.
- [ ] iOS Safari: record button captures audio as mp4, waveform animates.
- [ ] Auto-stop at 30 seconds.
- [ ] "Rekam Ulang" clears recording and returns to idle state.
- [ ] Upload succeeds and returns a GCS URL.
- [ ] "Gas Bikin dari Nada Ini" deducts 1 credit and starts a job.
- [ ] Status polling works identically to text-based generation.
- [ ] Completed track appears in AudioPlayer with "Buat Gift Card" button.
- [ ] Microphone permission denied state shows helpful message.
