# Kreasi AI — Music Video Novel Generator

Turn a character photo + music vibe into a cinematic MP4 music video — photorealistic storyboard scenes, AI-generated music, and dramatic transitions synced to the song's emotional arc.

## Architecture

```
User
 │
 ├─► Stage 1: Describe
 │   └─ Claude Sonnet (vision) → enhanced music prompt + 6-8 timepoints
 │      (each timepoint: timestamp, intensity, transition, scene desc)
 │
 ├─► Stage 2: Storyboard
 │   └─ WaveSpeed Seedream v4.5 → photorealistic frame per timepoint
 │      (character face preserved, Ken Burns-ready 9:16 portrait)
 │
 └─► Stage 3: Assemble
     ├─ WaveSpeed Lyria 3 Pro → music audio (WAV)
     └─ FFmpeg → Ken Burns (intensity-driven zoom) + xfade (variable duration)
                → MP4 with music overlay
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 19 + Tailwind CSS 4 + Motion |
| Backend | Node.js + Express (ESM) |
| Auth | WhatsApp OTP (Fonnte) → JWT |
| Image Gen | WaveSpeed Seedream v4.5 |
| Music Gen | WaveSpeed Lyria 3 Pro |
| Prompt AI | Anthropic Claude Sonnet (vision) |
| Video | FFmpeg (zoompan + xfade) |
| Database | better-sqlite3 + Supabase |
| Storage | Google Cloud Storage |
| Payments | Airwallex |
| Analytics | BigQuery |
| Deploy | Google Cloud Run (asia-southeast1) |

## Getting Started

```bash
cp .env.example .env
# Fill in WAVESPEED_API_KEY, ANTHROPIC_API_KEY, FONNTE_API_KEY, JWT_SECRET, etc.

npm install
npm run dev        # Vite frontend on :3000
npm run dev:server # Express backend on :3001
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite frontend dev server |
| `npm run dev:server` | Express backend with hot reload |
| `npm run build` | Production Vite build |
| `npm run lint` | TypeScript type check |
| `npm start` | Production server |

## Project Structure

```
kreasi-app/
├── server/
│   ├── lib/          # AI clients, DB, storage, payments
│   │   ├── anthropic.ts   # Stage 1: Claude vision prompt enhancement
│   │   ├── wavespeed.ts   # Stage 2: Seedream image generation
│   │   ├── lyria.ts       # Stage 3: Lyria 3 Pro music generation
│   │   ├── ffmpeg.ts      # Stage 3: Ken Burns + xfade assembly
│   │   ├── db.ts          # SQLite + Supabase sync
│   │   └── ...
│   ├── routes/
│   │   ├── stage1.ts  POST /api/stage1/enhance
│   │   ├── stage2.ts  POST /api/stage2/generate-frame
│   │   └── stage3.ts  POST /api/stage3/assemble (async 202)
│   └── index.ts
└── src/
    ├── App.tsx
    └── components/wizard/
        ├── Stage1/    # Form → enhanced prompt + timeline review
        ├── Stage2/    # Storyboard grid with regen
        └── Stage3/    # Progress + video player
```

## Credits

| Action | Credits |
|--------|---------|
| New user signup | +100 free |
| Stage 1 enhance | 5 |
| Stage 2 per frame | 5 × N frames |
| Stage 3 assembly | 30 |

## MCP Integration

Kreasi AI music generation is accessible directly from Claude Code via the [Imaji MCP](https://github.com/vintatan/imaji-mcp) server.

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `kreasi_login` | Send WhatsApp OTP to authenticate |
| `kreasi_verify_login` | Verify OTP — stores session for 30 days |
| `kreasi_create_music` | Generate music (polls until done, returns audio URL + lyrics + timepoints) |
| `kreasi_music_status` | Check status of a long-running job by ID |

### Quick Start

```bash
# In Claude Code, run:
/create-music lagu tentang rindu hujan malam, indie melancholic
```

Claude will guide you through WhatsApp login on first use.

### API Change: Expanded Status Response

`GET /api/music/status/:jobId` now returns the full job details when completed:

```json
{
  "status": "completed",
  "audioUrl": "https://...",
  "title": "Malam di Jakarta",
  "enhancedPrompt": "Indie Indonesian acoustic ballad...",
  "lyrics": "Verse 1:\n...",
  "timepoints": [{ "timestamp": "0:00", "label": "Intro", "mood": "melancholic" }, ...]
}
```

## Key Design Decisions

- **Dramatic sync**: Claude maps timepoints to lyrical moments; FFmpeg uses per-timepoint `transitionDuration` (0.3–1.2s) and intensity-driven Ken Burns zoom speed
- **Character consistency**: Seedream v4.5 receives the character photo on every frame generation with role-preserving prompt prefix
- **Async Stage 3**: Music + FFmpeg takes 2–4 min; server responds 202 immediately and client polls `/api/stage3/status/:jobId`
- **Credit safety**: Credits refunded on any AI failure in all 3 stages
