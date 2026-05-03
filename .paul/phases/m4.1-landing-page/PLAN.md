# Phase M4.1 — Emotional Landing Page

## Goal
Complete rewrite of `LandingPage.tsx`. The page sells the feeling of being remembered
through music — not features, not AI specs. No product screenshots above the fold.
Design direction: belonging, memory, human connection. All visuals are CSS/SVG — no
external image dependencies at this stage.

---

## Color Palette

```ts
const colors = {
  burgundy:   "#9B2335",   // primary — deep, warm, intimate
  roseGold:   "#C4A882",   // accent — highlight, CTA text
  amber:      "#C4844A",   // warm accent — story sections
  cream:      "#FFF8F0",   // background — candlelight
  nearBlack:  "#1A0A0E",   // dark backgrounds
  muted:      "#8B7355",   // muted text on cream
  white:      "#FFFFFF",
};
```

Typography:
- Headlines: `font-family: Georgia, 'Times New Roman', serif` (system serif — no import needed).
- Body / UI: existing sans-serif stack (already in Tailwind config).

---

## Section 1: Hero

**Background:** CSS radial gradient from near-black center outward, with soft amber
glow effect.
```css
background: radial-gradient(ellipse at center, #2D0A12 0%, #1A0A0E 60%);
/* + pseudo-element amber glow: */
background: radial-gradient(ellipse 60% 40% at 50% 70%, rgba(196,132,74,0.15) 0%, transparent 70%);
```

**Layout:** full viewport height, flex column, centered, text-align center.
No floating cards, no product UI above the fold.

**Headline** (Framer Motion `initial={{ opacity: 0, y: 30 }}`, animate on mount, 0.8s):
```
Ada lagu yang
cuma buat kamu.
```
Font: Georgia serif, size 56px mobile / 80px desktop, color white, line-height 1.15.

**Sub-headline** (fade-in, 0.3s delay):
```
Hadiah yang didengar, bukan hanya dilihat.
```
Font: sans-serif, 20px, color rose gold (#C4A882).

**CTA Button** (fade-in, 0.5s delay):
```
Bikin Lagu untuk Dia 🎁
```
Style: `background: linear-gradient(135deg, #C4A882, #9B2335)`, white text, 18px,
rounded-full, px-8 py-4, hover scale-105.
Action: scrolls to / navigates to authenticated MusicCreator.

**Social proof chips** (fade-in, 0.7s delay):
Three small pill badges in a row:
- `✓ Tanpa studio`
- `✓ Langsung jadi`
- `✓ Bisa dicetak`
Style: transparent border, muted text, small.

**Ambient Waveform:**
60 animated bars below the chips. Burgundy tones (#9B2335). Opacity 0.2.
Heights driven by `Math.sin` wave animation using `requestAnimationFrame`.
Each bar: width 4px, gap 3px, max-height 48px.
Animation: bars oscillate at different phases — natural-looking ambient wave.
```ts
// useEffect: rAF loop, update bar heights from sin(Date.now()/1000 + i*0.3) * 0.5 + 0.5
```

---

## Section 2: Story Vignettes (4 sections)

Each vignette uses scroll-triggered Framer Motion `whileInView` with
`viewport={{ once: true, margin: "-100px" }}` and `transition={{ duration: 0.6 }}`.

**Shared layout:** 2-col (text left, visual right) on `md+`, stacked on mobile.
Text col: `max-w-lg`, rich body copy. Visual col: CSS/SVG illustration or mockup.

### Vignette 1 — "Untuk Ibu"
Background: amber-tinted cream.
- Headline: "Lagu yang bikin Ibu nangis (bahagia)."
  Font: Georgia serif, 40px, burgundy.
- Body: "Rekam humming kamu atau tulis vibenya — AI kami bikin lagu yang terasa
  langsung dari hatimu."
- Visual: Bouquet illustration using CSS/SVG:
  - Circle of flower shapes (SVG `<circle>` + `<path>` petals) in pinks and amber.
  - QR tag hanging from stems (small white rectangle with fake scan lines).
  - No external SVG files — inline JSX SVG element.

### Vignette 2 — "Untuk Kekasih"
Background: deep burgundy to near-black gradient.
- Headline: "Bukan sekadar ucapan." (white text)
- Body: "Hadiah yang dia akan dengerin berulang-ulang." (rose gold text)
- Visual: Gift card mockup — pure CSS `div`:
  - 320×200px card, dark gradient background, rounded-2xl.
  - Fake track title "Lagu Buat Kamu ♥" in white serif.
  - Fake QR code (12×12 CSS grid of black squares, pattern is decorative not real).
  - "lovemelodia.com" watermark bottom-left.

### Vignette 3 — "Untuk Sahabat"
Background: warm amber gradient.
- Headline: "Karena ada yang susah diungkapkan dengan kata-kata."
- Body: "Kirim link-nya. Biarkan musiknya yang bicara."
- Visual: Phone mockup — CSS border-radius "device" frame (240×420px, dark border,
  rounded-3xl) containing a white inner screen showing:
  - URL bar: `lovemelodia.com/gift/...`
  - Fake gift card image (gradient rectangle, matching vignette 2 style).
  - Play button centered.

### Vignette 4 — "Cetak, tempel, hadiahin"
Background: cream/warm white.
- Headline: "Dari layar ke tangan mereka."
- Body: "Download gift tag-nya, print, tempel ke buket bunga atau kotak cokelat.
  QR-nya langsung ke lagunya."
- Visual: Chocolate box + print tag (CSS/SVG):
  - Simple box shape (CSS `div` with border and subtle shadow, amber fill).
  - Gift tag clipped on top (white `div` with burgundy border, hanging from box).
  - Fake QR lines + "Scan untuk dengerin 🎵" in small text on tag.

---

## Section 3: How It Works

Centered, cream background. Header: "Caranya gampang banget."

3-step layout (horizontal row on desktop, vertical on mobile):
Each step: number circle (burgundy, white text) + title + short description.

```
01                    02                    03
Pilih momen          AI bikin lagunya      Download & kirim
& rekam/tulis        (1–2 menit)           atau cetak
```

Steps are connected by a dotted line on desktop.

---

## Section 4: Occasions Grid

Header: "Untuk siapa kamu mau bikin lagu?"
Sub: "12 momen spesial yang bisa kamu abadikan."

12 tiles in 3-col desktop / 2-col mobile grid. Each tile:
- Square card (~140px), cream background, rounded-xl, subtle shadow.
- Large emoji (40px).
- Label (12px, muted, centered below emoji).
- Hover: `scale(1.04)` with burgundy border ring.

Occasions (same as M2.1):
🎂 Ulang Tahun · 💕 Untuk Kekasih · 🌸 Untuk Ibu · 🤝 Persahabatan
💍 Anniversary · 👨 Untuk Ayah · 🎓 Wisuda · 💒 Pernikahan
🙏 Terima Kasih · 🌙 Ramadan · 🎄 Natal · ✨ Bebas

Clicking any tile: navigate to MusicCreator with that occasion pre-selected
(pass as query param `?occasion=birthday`).

---

## Section 5: Final CTA

Full-bleed section: `background: linear-gradient(135deg, #C4844A, #9B2335)`.
Text centered, white.

Headline (Georgia serif, 44px):
```
Siapa yang ingin kamu kirimkan musiknya hari ini?
```

CTA button (white background, burgundy text, large):
```
Bikin Sekarang — Gratis 🎁
```

Sub-copy (white, opacity 0.8, 16px):
```
3 lagu gratis untuk memulai · Tanpa kartu kredit
```

---

## Footer

Minimal. Cream background.
- Left: Lovemelodia logo text (Georgia serif, burgundy).
- Center: copyright `© 2025 Lovemelodia`
- Right: "by Imaji AI" (muted, small) + language toggle BI/EN (placeholder, not functional yet).

---

## Implementation Notes

### Removals from kreasi-ai LandingPage

Remove entirely:
- YouTube embed section
- ShowcaseCarousel component (no public track showcase in Lovemelodia)
- 3-mode feature cards (Music LIVE / Novel+Video / etc.)
- Platform distribution section (TikTok/Spotify/etc.)
- Discord/WhatsApp group join CTA
- Social proof ticker (deferred — can be added later if needed)

Keep:
- Navbar structure (update text: "Masuk" button, logo)
- Framer Motion animation patterns
- `apiFetch` import structure

### Scroll Performance

All `whileInView` animations use `once: true` to avoid re-triggering on scroll-up.
Waveform animation uses a single `requestAnimationFrame` loop with cleanup on unmount.
No layout-triggering animations (only `opacity` and `transform`).

### Mobile Responsiveness

All sections use Tailwind responsive prefixes:
- Grid: `grid-cols-2 md:grid-cols-3` for occasions.
- Story vignettes: `flex-col md:flex-row`.
- Hero font: `text-4xl md:text-6xl lg:text-7xl` for headline.
- CTA button: full-width on mobile (`w-full md:w-auto`).

---

## Files Touched

| File | Change type |
|------|-------------|
| `src/components/LandingPage.tsx` | Complete rewrite |

Supporting components referenced but not changed:
- `src/components/Navbar.tsx` — update brand text to "Lovemelodia"
- `src/App.tsx` — ensure `/gift/:shareId` route exists (from M3.1)

---

## Acceptance Criteria
- [ ] Hero renders with warm dark gradient, no product screenshots.
- [ ] Headline fades in on load (not on scroll).
- [ ] All 4 story vignettes fade in on scroll (once only).
- [ ] Ambient waveform animates smoothly at 60fps without layout jank.
- [ ] All 12 occasion tiles render; clicking one navigates to MusicCreator.
- [ ] Final CTA button navigates to MusicCreator / triggers login if not authenticated.
- [ ] Page is fully responsive at 375px, 768px, and 1280px widths.
- [ ] No external image dependencies — all visuals are CSS/SVG/inline.
- [ ] No YouTube embed, no WhatsApp group CTA, no showcase carousel.
- [ ] Footer shows "by Imaji AI" with Lovemelodia branding.
