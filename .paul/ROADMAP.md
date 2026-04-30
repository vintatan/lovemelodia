# ROADMAP.md — Kreasi AI

## Milestone 1: Foundation + Full Stack
**Goal:** Working end-to-end app: auth → stage1 → stage2 → stage3 → MP4

### Phase 1.1 — Project Scaffold [ ]
- Init git, package.json (ESM, Vite + React 19 + Express)
- tsconfig.json, vite.config.ts, index.html
- .env.example, .gitignore, .dockerignore
- Create GitHub repo imaji/kreasi-ai, set remote, initial commit

### Phase 1.2 — Server Foundation [ ]
- server/index.ts (Express app, static serve, CORS, compression)
- server/lib/db.ts (SQLite: users, transactions, projects, frame_jobs, assembly_jobs)
- server/lib/otp.ts (generateOtp, storeOtp, verifyOtp, signToken, verifyToken)
- server/middleware/auth.ts (requireAuth JWT middleware)
- server/middleware/rateLimit.ts (copy from jati-ai-space)

### Phase 1.3 — Copy Server Libs [ ]
- server/lib/fonnte.ts (copy from jati-ai-space)
- server/lib/gcs.ts (copy from jati-ai-space)
- server/lib/airwallex.ts (copy from jati-ai-space)
- server/lib/cost-logger.ts (copy from jati-ai-space)
- server/lib/supabase.ts (copy from jati-ai-space)

### Phase 1.4 — Auth + Credits Routes [ ]
- server/routes/auth.ts (send-otp, verify-otp, 100 credits on signup)
- server/routes/credits.ts (balance, purchase, redeem-promo, verify-payment)
- server/routes/webhook.ts (Airwallex payment confirmation)
- server/routes/projects.ts (history, load by id)

### Phase 1.5 — AI Integrations (parallel) [ ]
- server/lib/wavespeed.ts (Seedream v4.5 image gen — port from jati-ai-space)
- server/lib/lyria.ts (WaveSpeed Lyria 3 Pro music gen — new)
- server/lib/anthropic.ts (Claude vision prompt enhancement + timepoints — new)

### Phase 1.6 — Stage Routes [ ]
- server/routes/stage1.ts (POST /enhance — Claude vision → timepoints)
- server/routes/stage2.ts (POST /generate-frame, /regenerate-frame, /approve)
- server/routes/stage3.ts (POST /assemble 202, GET /status/:jobId)

### Phase 1.7 — FFmpeg Assembly [ ]
- server/lib/ffmpeg.ts (assembleVideo: Ken Burns + xfade with per-timepoint intensity + music overlay)
- Intensity-driven zoom speed: low=0.0005, medium=0.001, high=0.003
- Variable xfade duration from timepoint.transitionDuration (0.3–1.2s)

## Milestone 2: Frontend Wizard

### Phase 2.1 — Design System + Auth UI [ ]
- src/index.css (copy jati-ai-space color tokens, shadow-glow, gradients)
- src/App.tsx (AuthGate → WizardShell, single canvas, no router)
- src/components/UI.tsx (Button, Spinner, Toast, Card — jati-ai-space design)
- src/components/AuthGate.tsx (phone OTP flow)
- src/components/CreditsBadge.tsx, CreditsModal.tsx

### Phase 2.2 — Stage 1 Components [ ]
- Stage1Form.tsx (character upload + theme picker + vibe input)
- CharacterUploader.tsx (drag-drop image)
- ThemePicker.tsx (fairytale/real life/city/sci-fi/nature cards)
- Stage1Result.tsx (enhanced prompt review + timepoint timeline)
- TimepointTimeline.tsx (scrollable dramatic arc cards)

### Phase 2.3 — Stage 2 Storyboard [ ]
- Stage2Storyboard.tsx (sequential frame generation with progress)
- StoryboardGrid.tsx (comic-strip responsive grid)
- StoryboardFrame.tsx (image + mood badge + regen button)

### Phase 2.4 — Stage 3 Assembly + Video [ ]
- Stage3Assembly.tsx (async progress: generating_music → assembling → done)
- VideoPlayer.tsx (final MP4 player + download button)

## Milestone 3: Ship

### Phase 3.1 — Docker + CI/CD [ ]
- Dockerfile (node:20-slim + apt install ffmpeg + Vite build)
- .github/workflows/ci.yml (lint + build + playwright)
- .github/workflows/deploy.yml (Cloud Run asia-southeast1, --timeout=900 --memory=2Gi)

### Phase 3.2 — Push + PR [x]
- Push to imaji/kreasi-ai
- Open pull request

## Milestone 4: Music UX & Persistence

### Phase 4.1 — Fix Music Player [ ]
- Diagnose audio not playing (CORS on Wavespeed URL, proxy if needed)
- Verify audioUrl flows correctly from status poll → MusicCreator state → <audio> src

### Phase 4.2 — Indonesian Gen Z Prompt Engineering [ ]
- Update enhanceMusicPrompt() in server/lib/anthropic.ts
- System prompt: Indonesian language, Gen Z viral tone, music/song focus only
- No video language — output is pure music production brief

### Phase 4.3 — Enhance Prompt Button (Frontend) [ ]
- POST /api/music/enhance-prompt endpoint (new server route)
- Returns enhanced prompt with dramatic timepoints in Indonesian
- Add "Perkuat Prompt" button to MusicCreator.tsx
- Show timepoints preview below textarea before generating

### Phase 4.4 — Supabase Persistence [ ]
- Ensure SUPABASE_URL + SUPABASE_SERVICE_KEY match jati-ai-space keys
- Persist music_jobs to Supabase (id, phone, prompt, enhanced_prompt, status, audio_url)
- Add enhanced_prompt column to music_jobs schema
- Store enhanced_prompt on job creation; update on completion
