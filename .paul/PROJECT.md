# PROJECT.md — Lovemelodia

## Core Value
Create AI-generated music as a heartfelt gift for loved ones — wrap it in a beautiful occasion-themed gift card and share digitally or slip the QR tag into a physical gift (chocolate box, flower bouquet, wedding favor). Every gift tells a story through music.

## Tagline
"Create music for your loved ones"

## What We're Building
A full-stack web app (Vite + React 19 + Express) that:
- Lets users generate AI music via text prompt (Lyria 3 Pro) OR voice/humming (LeVo SongGeneration)
- Wraps the music in a beautifully designed occasion gift card (12 themes: Birthday, Lover, Mother's Day, etc.)
- Outputs three shareable formats: 1080×1080 PNG (feed/WA), 1080×1920 MP4 (Stories/TikTok), 85×55mm print tag (physical gift)
- Public gift link: recipient opens `lovemelodia.com/gift/{id}` and plays the music — no login required
- Authenticates via WhatsApp OTP (Fonnte) — no passwords
- i18n: Bahasa Indonesia + English from day 1
- Deploys to Google Cloud Run (asia-southeast1)

## Stack
- **Frontend:** React 19 + Vite + Tailwind CSS 4 + Motion + Lucide React
- **Backend:** Node.js + Express + better-sqlite3 + Supabase
- **Auth:** Fonnte WhatsApp OTP → JWT
- **Music (text):** WaveSpeed Lyria 3 Pro
- **Music (voice):** WaveSpeed SongGeneration (LeVo) with prompt_audio
- **Gift Cards:** Sharp (image composition) + FFmpeg (video) + qrcode
- **Storage:** Google Cloud Storage
- **Payments:** HitPay (IDR) + Stripe (global)
- **Analytics:** BigQuery cost logging

## Reference Implementations
- `/Users/jesi/imaji/kreasi-ai/` — Auth, credits, Lyria music gen, FFmpeg, GCS, HitPay (copy patterns)

## GitHub
- Repo: `imaji/lovemelodia` (new)
- Local: `/Users/jesi/imaji/lovemelodia/`
- Domain: `lovemelodia.com`
- Region: `asia-southeast1`
- Cloud Run service: `lovemelodia`

## Target Users
Anyone who wants to gift music to someone they love — globally, launching Indonesia first. Occasions: birthdays, Valentine's, Mother's Day, anniversaries, graduations, weddings, Lebaran, Christmas, friendships.

## Positioning
**Global product. Indonesia first launch.**
Lovemelodia is not a music creation tool — it's a gifting platform. The music is the gift, not the product.
