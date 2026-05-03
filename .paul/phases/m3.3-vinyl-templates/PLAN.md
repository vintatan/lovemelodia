# Phase m3.3 — Vinyl Templates

Premium vinyl record-style print templates. The vinyl IS the physical gift — print it, stick it on a chocolate box, slip it into a bouquet, mail it. QR code scanned → music plays.

---

## Acceptance Criteria

- Vinyl template output added to gift card generation (optional upgrade, +1 credit)
- 148×148mm square card (7" vinyl style): dark circular disc with CSS groove rings, center label with QR
- A4 sticker sheet: 4 vinyl stickers per A4 sheet (each ~80mm diameter)
- Animated vinyl social video: rotating vinyl disc + music playing (9:16, 15s MP4)
- 12 center label color themes matching occasion templates
- Download button: "🎵 Download Vinyl Card (Premium)" shown after basic gift card is generated
- GiftCardCreator shows vinyl preview thumbnail

---

## Vinyl Card Design

148×148mm square card, 300dpi = 1748×1748px

```
┌─────────────────────────┐
│     ○  ○  ○  ○  ○      │  ← top holes row (film/vinyl aesthetic)
│  ┌───────────────────┐  │
│  │    [dark disc]    │  │
│  │  ┌─────────────┐  │  │  ← groove rings (concentric circles)
│  │  │ ┌─────────┐ │  │  │
│  │  │ │  [QR]   │ │  │  │  ← center label: colored circle
│  │  │ │ title   │ │  │  │    QR code + track + recipient + "lovemelodia"
│  │  │ └─────────┘ │  │  │
│  │  └─────────────┘  │  │
│  └───────────────────┘  │
│     ○  ○  ○  ○  ○      │  ← bottom holes row
└─────────────────────────┘
```

---

## Implementation

### `server/lib/giftcard.ts` — Add `generateVinylCard()` function

```typescript
async function generateVinylCard({ shareId, trackTitle, recipientName, occasion, audioUrl }) {
  const SIZE = 1748; // 148mm at 300dpi

  // 1. Generate QR code (small, 280×280 for center label)
  const qrBuffer = await QRCode.toBuffer(
    `https://lovemelodia.com/gift/${shareId}`,
    { width: 280, margin: 0, color: { dark: '#1a0a0a', light: '#FFFFFF' } }
  );

  // 2. Build vinyl SVG:
  //    - Black circle (disc), diameter = SIZE * 0.85
  //    - 8 concentric groove ring strokes (rgba white, 0.05 opacity)
  //    - Center label circle (diameter = SIZE * 0.32), filled with occasion color
  //    - Track title text (white, 18px, centered above QR)
  //    - Recipient name (white bold, 22px, below QR)
  //    - "lovemelodia.com" (white@60%, 12px, bottom of label)
  //    - Vinyl hole rows top+bottom (decorative)

  // 3. Composite QR onto SVG center label position

  // 4. Output: /tmp/{shareId}-vinyl.png (1748×1748)

  // 5. A4 sticker sheet: place 4 vinyl images on 3508×2480 (A4 landscape 300dpi)
  //    → /tmp/{shareId}-sticker-sheet.png

  // 6. Animated vinyl video:
  //    ffmpeg: rotate vinyl PNG + play audio (15s), 9:16 frame, vinyl centered
  //    Use ffmpeg rotate filter: rotate=2*PI*t/8 (full rotation every 8s)
  //    Background: dark gradient matching occasion
  //    → /tmp/{shareId}-vinyl-video.mp4

  // 7. Upload all 3 to GCS:
  //    gifts/{shareId}/vinyl-card.png
  //    gifts/{shareId}/sticker-sheet.png
  //    gifts/{shareId}/vinyl-video.mp4

  // 8. Cleanup /tmp files

  // Returns:
  return { vinylCardUrl, stickerSheetUrl, vinylVideoUrl };
}
```

---

### `server/routes/giftcard.ts` — Update POST /api/giftcard/generate

- Accept optional `includeVinyl: boolean` in request body
- If `includeVinyl` is true: call `generateVinylCard()` after base gift card generation → deduct +1 extra credit
- Return additional URLs in response: `vinylCardUrl`, `stickerSheetUrl`, `vinylVideoUrl`

---

### `src/components/gift/GiftCardCreator.tsx` — Additions

After template picker:
- "➕ Tambahkan Vinyl Card (1 kredit ekstra)" toggle
- When toggled on: show static CSS vinyl illustration as preview mockup

After generation (if vinyl was requested), show 3 additional download buttons:
- "🎵 Download Vinyl Card (Cetak 148×148mm)"
- "🎵 Download Sticker Sheet (4 per A4)"
- "🎵 Download Vinyl Video (Stories/TikTok)"

Notes:
- Vinyl video is the premium social sharing option (rotating vinyl disc is visually distinctive)
- 12 center label color themes should map 1:1 to existing occasion palette values
