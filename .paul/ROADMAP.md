# ROADMAP.md — Lovemelodia

## Milestone 1: Foundation

### Phase 1.1 — Scaffold + Branding [ ]
- Rename all "Kreasi AI" references → "Lovemelodia" throughout codebase
- Update color palette: warm burgundy/rose gold/amber (away from red/orange)
- New logo placeholder + favicon
- Update index.html title, meta description
- i18n scaffold: BI + English toggle
- Update .env.example with lovemelodia-specific vars
- Remove kreasi-ai-specific routes (album, novel, wizard)

### Phase 1.2 — Auth + Credits [ ]
- Port WhatsApp OTP auth from kreasi-ai (Fonnte) — keep as-is
- New credit model: 1 credit = 1 gift card generation
- New users: 3 free credits on signup
- Remove old credit packages, add: Starter 5 / Creator 15 / Unlimited monthly

### Phase 1.3 — Payments [ ]
- HitPay for IDR (port from kreasi-ai)
- Stripe for global (USD, SGD, etc.)

## Milestone 2: Music Generation

### Phase 2.1 — Text-to-Music (Lyria 3 Pro) [ ]
- Port /api/music/generate + status polling from kreasi-ai
- Simplified prompt: occasion selector → auto-generate prompt
- One-shot generation (no enhance-prompt step)

### Phase 2.2 — Voice Melody Input (LeVo) [ ]
- Browser MediaRecorder (iOS MP4 + Android WebM)
- POST /api/music/upload-recording → GCS
- POST /api/music/generate-from-melody → WaveSpeed SongGeneration (LeVo)
- Same polling/done flow as Lyria

## Milestone 3: Gift Card System

### Phase 3.1 — Image + Video + Print Generation [ ]
- Sharp image composition: template BG + message + QR + watermark → 1080×1080 PNG
- FFmpeg Stories video → 1080×1920 MP4, 15s
- Print tag → 85×55mm 300dpi PNG (QR + message + hole punch)
- 12 occasion template PNGs in public/templates/
- Public share page: /gift/:shareId (no auth required)

### Phase 3.2 — Custom Photo Upload [ ]
- File upload (JPG/PNG/WebP, max 5MB) as custom template background
- Auto-crop to cover art area

### Phase 3.3 — Vinyl Print Templates (Premium Add-On) [ ]
- Vinyl record-style print template: circular dark disc with groove rings, center label with QR code
- Output formats:
  - 148×148mm square card (7" vinyl style) — print at home, 300dpi PNG
  - A4 sticker sheet (4 vinyl stickers per sheet) — print on sticker paper
  - Animated vinyl rotation video (9:16, 15s) — for social sharing
- Center label design: recipient name + occasion + track title + QR code + lovemelodia.com
- 12 label color themes matching occasion templates
- Premium service: additional 1 credit on top of base gift card generation
- The vinyl card IS the physical gift — stick it on the chocolate box, slip into bouquet, mail it

### Phase 2.3 — Story Interview (Lyric Builder) [ ]
- Before music generation, bot asks 3-5 emotionally-targeted questions by occasion
- Questions surface real memories → Claude builds personalized lyrics from answers
- Question sets per occasion (examples):
  - Mother's Day: "Apa kenangan paling berkesan bersama ibumu?", "Kalimat apa yang selalu ibu kamu ucapkan?", "Momen apa yang bikin kamu paling bangga di depan ibumu?"
  - Lover: "Momen pertama kamu sadar jatuh cinta?", "Hal terkecil yang dia lakuin yang bikin kamu senyum sendiri?"
  - Birthday: "Apa pencapaian terbesar orang ini tahun ini?", "Apa yang bikin kamu paling bangga sama dia?"
  - Friendship: "Kenangan paling lucu atau berkesan kalian berdua?", "Apa yang kamu paling syukuri dari persahabatan ini?"
- Conversational UI: one question at a time, animated typing effect, warm tone
- Answers → Claude Sonnet → lyric outline + emotional prompt → passed to Lyria for generation
- New endpoint: POST /api/music/build-story → { occasion, answers[] } → { enhancedPrompt, lyricOutline }

## Milestone 4: Landing Page + Launch

### Phase 4.1 — Emotional Landing Page [ ]
- Full-bleed warm hero: golden hour, human connection, NO product UI above fold
- Headline: "Ada lagu yang cuma buat kamu." / "A song made just for you."
- Scroll sections: 4 human stories (mother/bouquet, best friends, couple, grandchild)
- Color palette: deep burgundy, rose gold, amber, candlelight cream
- Ambient muted background music
- Final CTA: "Siapa yang ingin kamu kirimkan musiknya hari ini?"

### Phase 4.2 — Ship [ ]
- GitHub repo: imaji/lovemelodia
- Cloud Run: lovemelodia service, asia-southeast1
- Domain: lovemelodia.com
- Launch: Instagram, TikTok, WhatsApp groups (Indonesia first)
