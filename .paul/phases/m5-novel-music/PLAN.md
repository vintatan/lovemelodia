# PLAN — M5: Novel Music

## Context
After a music track is generated, users can trigger "Novel Music": AI generates one cinematic image per timepoint, then FFmpeg assembles them with the audio into a full MP4 video synced to the song's dramatic arc. This ships the "Musik Novel" feature already teased on the landing page.

## Acceptance Criteria
- [ ] POST /api/novel/generate accepts a completed musicJobId, returns 202 + novelJobId
- [ ] GET /api/novel/status/:jobId returns status + imageUrls (partial) + videoUrl when done
- [ ] Images generated per timepoint using Wavespeed nano-banana-2
- [ ] Image prompts generated in English by Claude from Indonesian timepoints + music context
- [ ] Video assembled by FFmpeg (Ken Burns + xfade) synced to timepoint timestamps
- [ ] Video + images uploaded to GCS
- [ ] MusicCreator "done" phase shows "Bikin Novel Musik 🎬" button
- [ ] NovelCreator shows storyboard grid (images pop in as they complete) + video player
- [ ] Timepoints persisted in music_jobs.timepoints_json (set during enhance-prompt or at novel time)
- [ ] novel_jobs persisted to Supabase

---

## Architecture

### Pipeline (all async, server-side)
```
POST /api/novel/generate
  → validate music_job (completed, has audio_url)
  → ensure timepoints exist (stored or generate via Claude now)
  → createNovelJob → return 202 + novelJobId
  → [async] generateStoryboardImagePrompts() — 1 Claude call for ALL timepoints
  → for each timepoint in parallel (capped at 3 concurrent):
      generateNanoBananaImage(prompt) → uploadUrlToGcs → store in novel_jobs.image_urls_json
  → updateNovelJob(jobId, "assembling", imageUrls)
  → assembleVideo(imageUrls, audioUrl, mappedTimepoints) → tmpMp4
  → uploadToGcs(mp4, "video/mp4", "novels", phone)
  → updateNovelJob(jobId, "completed", imageUrls, videoUrl)
```

### Status values
`pending` → `generating_images` → `assembling` → `uploading` → `completed` / `failed`

### Credits
50 credits flat (covers ~7 images + assembly)

---

## Files

### New files
| File | Purpose |
|------|---------|
| `server/lib/wavespeed-nano.ts` | Wavespeed nano-banana-2 text-to-image |
| `server/routes/novel.ts` | POST generate, GET status |
| `src/components/music/NovelCreator.tsx` | Storyboard grid + video player |

### Modified files
| File | Change |
|------|--------|
| `server/lib/anthropic.ts` | Add `generateStoryboardImagePrompts()` |
| `server/lib/db.ts` | Add `novel_jobs` table + `timepoints_json` to `music_jobs` |
| `server/lib/supabase.ts` | Add `createNovelJobInSupabase`, `updateNovelJobInSupabase` |
| `server/index.ts` | Mount `/api/novel` router |
| `server/routes/music.ts` | Store timepoints_json in music_jobs on enhance-prompt |
| `src/components/music/MusicCreator.tsx` | "Bikin Novel Musik" button in done phase |

---

## Key Implementation Details

### Wavespeed nano-banana-2 endpoint
```
POST https://api.wavespeed.ai/api/v3/wavespeed-ai/flux1-dev-nano-banana-2
Body: { prompt: string, size: "1280*720", enable_sync_mode: true }
```
Same submit-then-poll pattern as lyria.ts and wavespeed.ts.

### Claude: generateStoryboardImagePrompts()
Single call, returns one English image prompt per timepoint:
```
Input: enhancedMusicPrompt, timepoints[], genres[]
Output: prompts: string[]  (same length as timepoints)
```
System: "Translate Indonesian scene descriptions into English cinematic image prompts for an AI image generator. Cinematic, photorealistic, atmospheric. No people/faces unless explicitly in description. Safe, clean content."

### FFmpeg mapping (novel timepoints → full Timepoint interface)
```typescript
mood → intensity: euphoric/triumphant → "high", tense → "medium", else → "low"
intensity → transitionDuration: high→0.4, medium→0.6, low→1.0
transition: high→"wipeleft", medium→"dissolve", low→"fade"
```
Reuse existing `assembleVideo()` from `server/lib/ffmpeg.ts`.

### DB schema additions
```sql
-- migration
ALTER TABLE music_jobs ADD COLUMN timepoints_json TEXT;

-- new table
CREATE TABLE IF NOT EXISTS novel_jobs (
  id               TEXT PRIMARY KEY,
  music_job_id     TEXT NOT NULL,
  phone            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  image_urls_json  TEXT,
  video_url        TEXT,
  error            TEXT,
  credits_used     INTEGER NOT NULL DEFAULT 50,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_novel_jobs_phone ON novel_jobs(phone);
```

### Frontend NovelCreator states
```
idle → generating (storyboard grid with loading cards) → done (grid + video player) → error
```
Storyboard grid: show 6-8 placeholder cards, each pops in with motion.div spring as image_urls arrive.

---

## Execution Order
1. `server/lib/db.ts` — schema + functions
2. `server/lib/wavespeed-nano.ts` — image gen
3. `server/lib/anthropic.ts` — add generateStoryboardImagePrompts
4. `server/lib/supabase.ts` — novel persistence
5. `server/routes/novel.ts` — full async pipeline
6. `server/routes/music.ts` — store timepoints_json
7. `server/index.ts` — mount router
8. `src/components/music/NovelCreator.tsx` — storyboard + video UI
9. `src/components/music/MusicCreator.tsx` — wire up button + NovelCreator
