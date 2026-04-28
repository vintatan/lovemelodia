# PROJECT.md — Kreasi AI

## Core Value
Turn a character photo + music vibe into a full MP4 music video novel — photorealistic storyboard images, AI-generated music, and dramatic transitions synced to the song's emotional arc. Three-stage flow with user checkpoints at each step.

## What We're Building
A full-stack web app (Vite + React 19 + Express) that:
- Accepts character images, descriptions, themes, and music vibe text from users
- Calls Claude Sonnet (vision) to generate an enhanced music production prompt + 6–8 dramatic timepoints synced to the song's lyrical arc
- Generates photorealistic storyboard images per timepoint via WaveSpeed Seedream v4.5
- Generates music via WaveSpeed Lyria 3 Pro
- Assembles a final MP4 using FFmpeg: Ken Burns per frame (intensity-driven zoom speed) + xfade transitions (variable duration per timepoint intensity) + music overlay
- Authenticates via WhatsApp OTP (Fonnte) — no passwords
- Tracks credits per user (100 free on signup)
- Deploys to Google Cloud Run (asia-southeast1)

## Stack
- **Frontend:** React 19 + Vite + Tailwind CSS 4 + Motion + Lucide React (design system from jati-ai-space)
- **Backend:** Node.js + Express + better-sqlite3 + Supabase
- **Auth:** Fonnte WhatsApp OTP → JWT
- **Music:** WaveSpeed Lyria 3 Pro
- **Images:** WaveSpeed Seedream v4.5
- **Video:** FFmpeg (Ken Burns zoompan + xfade timed to timepoints)
- **Storage:** Google Cloud Storage
- **Payments:** Airwallex
- **Analytics:** BigQuery cost logging

## Reference Implementations
- `/Users/jesi/imaji/jati-ai-space/` — Auth, credits, Seedream image gen, FFmpeg splice, GCS, Airwallex, cost-logger (copy verbatim)
- `/Users/jesi/imaji/kreasi-ai/test_lyria.js` — Lyria fallback (Vertex AI) if WaveSpeed Lyria 3 Pro endpoint fails

## GitHub
- Repo: `imaji/kreasi-ai` (new, separate from vintatan/kreasi-ai)
- Local: `/Users/jesi/imaji/kreasi-app/`
- Region: `asia-southeast1`
- Cloud Run service: `kreasi-ai`

## Target Users
Indonesian/SEA creators who want cinematic music video content from a single character photo and a music mood.
