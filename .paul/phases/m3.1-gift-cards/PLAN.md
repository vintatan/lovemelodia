# Phase M3.1 — Gift Card Generation System

## Goal
Build the core gift card engine. From a completed music job, generate three shareable
assets: a square feed image (1080×1080), a Stories/TikTok video (1080×1920, 15s), and
a printable gift tag (1004×650). All three are uploaded to GCS and linked via a public
share URL.

---

## New Dependencies

```
npm install sharp qrcode
npm install --save-dev @types/qrcode
```

`ffmpeg` must be available in the deployment environment (already present in kreasi-ai
for video assembly — confirm it is in the Lovemelodia server Dockerfile / Cloud Run image).

---

## Database: New Table

Add to `server/lib/db.ts` (migration block, same try/catch pattern as existing migrations):

```sql
CREATE TABLE IF NOT EXISTS share_links (
  id           TEXT PRIMARY KEY,
  music_job_id TEXT NOT NULL,
  message      TEXT,
  template_id  TEXT NOT NULL DEFAULT 'birthday',
  image_url    TEXT,
  video_url    TEXT,
  print_tag_url TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Add prepared statements:
```ts
insertShareLink:   db.prepare("INSERT INTO share_links (id, music_job_id, message, template_id, image_url, video_url, print_tag_url) VALUES (?, ?, ?, ?, ?, ?, ?)"),
getShareLink:      db.prepare("SELECT * FROM share_links WHERE id = ?"),
updateShareLink:   db.prepare("UPDATE share_links SET image_url = ?, video_url = ?, print_tag_url = ? WHERE id = ?"),
```

Export functions `createShareLink`, `getShareLink`, `updateShareLink` following the
same pattern as `createMusicJob` / `getMusicJob`.

---

## New File: `server/lib/giftcard.ts`

### Templates

```ts
export const TEMPLATES = [
  { id: "birthday",    label: "Ulang Tahun",   color: "#E91E8C" },
  { id: "lover",       label: "Untuk Kekasih", color: "#9B2335" },
  { id: "anniversary", label: "Anniversary",   color: "#C4A882" },
  { id: "friendship",  label: "Persahabatan",  color: "#009688" },
  { id: "mother",      label: "Untuk Ibu",     color: "#E91E63" },
  { id: "father",      label: "Untuk Ayah",    color: "#1565C0" },
  { id: "graduation",  label: "Wisuda",        color: "#6A1550" },
  { id: "wedding",     label: "Pernikahan",    color: "#C4A882" },
  { id: "gratitude",   label: "Terima Kasih",  color: "#C4844A" },
  { id: "ramadan",     label: "Ramadan",       color: "#1A237E" },
  { id: "christmas",   label: "Natal",         color: "#C62828" },
  { id: "custom",      label: "Custom",        color: "#333333" },
];
```

Template PNGs live at `public/templates/{templateId}.png`. Generate them with a
one-time setup script (`scripts/generate-templates.ts`) that uses Sharp to create
1080×1080 gradient PNGs for each template. Each template PNG is a radial or linear
gradient using the template's `color`. The script should be run once during deployment
setup; the PNG files are committed to the repo.

**Setup script** (`scripts/generate-templates.ts`):
```ts
import sharp from "sharp";
// For each template, create a gradient via SVG → Sharp pipeline:
// SVG with <linearGradient> from template.color to a darker variant
// sharp(Buffer.from(svgString)).resize(1080, 1080).png().toFile(...)
```

---

### `generateGiftCard` function

```ts
export async function generateGiftCard(params: {
  musicJob: { id: string; audio_url: string; title: string | null };
  templateId: string;
  message: string;
  shareId: string;
  photoUrl?: string;
}): Promise<{ imageUrl: string; videoUrl: string; printTagUrl: string }>
```

**Step 1: Fetch audio**
```ts
const audioResp = await fetch(params.musicJob.audio_url);
const audioBuffer = await audioResp.arrayBuffer();
const audioPath = `/tmp/${params.musicJob.id}-audio.wav`;
fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
```

**Step 2: Load or generate background**

If `photoUrl` is provided:
```ts
const photoResp = await fetch(photoUrl);
const photoBuf = await photoResp.arrayBuffer();
const bgBuffer = await sharp(Buffer.from(photoBuf))
  .resize(1080, 1080, { fit: "cover", position: "centre" })
  .toBuffer();
```

If no photoUrl, use template PNG:
```ts
const bgBuffer = await sharp(`public/templates/${templateId}.png`)
  .resize(1080, 1080)
  .toBuffer();
```

**Step 3: Generate QR code**
```ts
import QRCode from "qrcode";
const qrBuffer = await QRCode.toBuffer(
  `https://lovemelodia.com/gift/${shareId}`,
  { width: 400, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } }
);
```

**Step 4: Compose feed image (1080×1080)**
```ts
const feedPath = `/tmp/${shareId}-feed.png`;
await sharp(bgBuffer)
  .composite([
    // Dark overlay
    { input: Buffer.from(`<svg width="1080" height="1080"><rect width="1080" height="1080" fill="rgba(0,0,0,0.4)"/></svg>`), blend: "over" },
    // QR code bottom-right (200×200, 40px margin)
    { input: await sharp(qrBuffer).resize(200, 200).toBuffer(), top: 840, left: 840 },
    // Message text SVG (white bold 52px, centered, 60px from top)
    { input: Buffer.from(messageSvg(message, 1080, 52)), blend: "over" },
    // Track title SVG (white 38px, centered, below message)
    { input: Buffer.from(titleSvg(trackTitle, 1080, 38)), blend: "over" },
    // Watermark SVG (white@50%, 24px, bottom-left)
    { input: Buffer.from(watermarkSvg()), blend: "over" },
  ])
  .toFile(feedPath);
```

SVG helper functions:
- `messageSvg(text, width, size)` → SVG with `<text>` element, bold, white, centered,
  y=120. Handle line wrapping at 28 chars → newline.
- `titleSvg(text, width, size)` → same but y=200, normal weight, italic.
- `watermarkSvg()` → `<text>` "lovemelodia.com", white at opacity 0.5, size 24, bottom-left (x=40, y=1050).

**Step 5: Compose print tag (1004×650)**
```ts
const printPath = `/tmp/${shareId}-print.png`;
const template = TEMPLATES.find(t => t.id === templateId)!;

await sharp({ create: { width: 1004, height: 650, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .composite([
    // Left accent border (8px wide, full height, template color)
    { input: Buffer.from(accentBorderSvg(template.color)), blend: "over" },
    // QR code large (400×400), centered-left (x=50, y=125)
    { input: await sharp(qrBuffer).resize(400, 400).toBuffer(), top: 125, left: 50 },
    // Right side text
    { input: Buffer.from(printTextSvg(message, trackTitle, template.color)), blend: "over" },
    // Hole punch marker top-right
    { input: Buffer.from(holePunchSvg()), blend: "over" },
  ])
  .png()
  .toFile(printPath);
```

SVG helpers for print tag:
- `accentBorderSvg(color)` → 1004×650 SVG with `<rect width="8" height="650" fill="{color}"/>`.
- `printTextSvg(message, title, brandColor)` → right panel (x=500 area), containing:
  - Message text: black, 42px bold, x=530, y=200, max-width 440px.
  - "Scan untuk dengerin 🎵": gray (#555), 28px, x=530, y=320.
  - "lovemelodia.com": brandColor, 22px, x=530, y=580.
- `holePunchSvg()` → small circle (r=20) outline at top-right corner (x=970, y=40).

**Step 6: FFmpeg Stories video (1080×1920, 15s)**
```ts
const storiesPath = `/tmp/${shareId}-stories.mp4`;
await execPromise(
  `ffmpeg -y -loop 1 -i "${feedPath}" -i "${audioPath}" ` +
  `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" ` +
  `-c:v libx264 -c:a aac -b:a 192k -t 15 -pix_fmt yuv420p "${storiesPath}"`
);
```

**Step 7: Upload all 3 to GCS**
```
gifts/{shareId}/feed.png
gifts/{shareId}/stories.mp4
gifts/{shareId}/print.png
```
Use existing GCS upload helper from kreasi-ai (`uploadToGCS` or equivalent).

**Step 8: Cleanup /tmp files**
```ts
for (const p of [audioPath, feedPath, storiesPath, printPath]) {
  try { fs.unlinkSync(p); } catch { /* ignore */ }
}
```

**Return:**
```ts
return { imageUrl, videoUrl, printTagUrl };
```

---

## New File: `server/routes/giftcard.ts`

```ts
const router = Router();

// GET /api/giftcard/templates → public, no auth needed
router.get("/templates", (_req, res) => {
  return res.json({ templates: TEMPLATES });
});

// POST /api/giftcard/upload-photo (auth required)
// multipart, field: "photo" (image/*)
// → uploads to GCS: photos/{phone}/{nanoid()}.jpg (Sharp converts to JPEG)
// → returns { photoUrl }
router.post("/upload-photo", auth, upload.single("photo"), async (req, res) => { ... });

// POST /api/giftcard/generate (auth required)
// body: { musicJobId, templateId, message, photoUrl? }
// → validate musicJob belongs to phone
// → validate credits (no additional deduction — generation was charged in M2)
// → create share_links row with nanoid() shareId
// → async: generateGiftCard(...) → updateShareLink(shareId, imageUrl, videoUrl, printTagUrl)
// → return 202 { shareId }
router.post("/generate", auth, async (req, res) => { ... });

// GET /api/giftcard/status/:shareId (auth required)
// → returns { status: "pending"|"done"|"failed", imageUrl, videoUrl, printTagUrl }
router.get("/status/:shareId", auth, async (req, res) => { ... });

export default router;
```

### Public Share Endpoint (mounted separately in `server/index.ts`)

```ts
// GET /api/share/:shareId (public — no auth)
app.get("/api/share/:shareId", async (req, res) => {
  const link = getShareLink(req.params.shareId);
  if (!link) return res.status(404).json({ error: "Not found" });
  const job = getMusicJob(link.music_job_id);
  return res.json({
    title: job?.title ?? "Lagu Untukmu",
    message: link.message,
    templateId: link.template_id,
    imageUrl: link.image_url,
    audioUrl: job?.audio_url,
  });
});
```

---

## Mount in `server/index.ts`

```ts
import giftcardRouter from "./routes/giftcard.js";
app.use("/api/giftcard", giftcardRouter);
// public share endpoint mounted directly on app (see above)
```

---

## New Component: `src/components/music/GiftCardCreator.tsx`

### Props
```ts
interface GiftCardCreatorProps {
  token: string;
  musicJobId: string;
  trackTitle: string;
}
```

### Step 1: Template Selection
- Header: "Pilih Tema Gift Card"
- 12 template tiles in horizontal scrollable row (mobile) / 4-col grid (desktop).
  - Each tile: 80×80 thumbnail (gradient background matching template color) + label.
  - First tile: "📷 Foto Kamu" → clicking triggers `<input type="file" accept="image/*">`.
  - On file select: upload via `POST /api/giftcard/upload-photo` → set `photoUrl`.
    Show thumbnail preview in that tile slot.
  - Selecting a template: highlight with burgundy border ring.

### Step 2: Message Input
- Label: "Tulis pesan kamu"
- Textarea: 60 chars max.
- Char counter: "43/60" shown at bottom-right of textarea in small muted text.
- Placeholder: "Selamat ulang tahun, semoga selalu bahagia 🎁"

### Step 3: Generate
- Button: "Buat Gift Card 🎁" — disabled until template selected + message not empty.
- On click: `POST /api/giftcard/generate` → poll `GET /api/giftcard/status/:shareId`.
- Loading: "Lagi bikin gift card-mu... 🎨" with subtle spinner.

### Step 4: Done — Download Panel
Three download buttons + copy link:

```
[ ⬇ Gambar (Feed / WA) ]
[ ⬇ Video (Stories / TikTok) ]
[ 🖨 Print Tag (Buket / Cokelat) ]
[ 🔗 Copy Link ]
```

- "⬇ Gambar" → `<a href={imageUrl} download>` for feed PNG.
- "⬇ Video" → `<a href={videoUrl} download>` for stories MP4.
- "🖨 Print Tag" → `<a href={printTagUrl} download>` for print PNG.
- "🔗 Copy Link" → `navigator.clipboard.writeText("https://lovemelodia.com/gift/{shareId}")` → button text changes to "✓ Disalin!" for 2s.
- Print tag helper text below buttons (small, muted):
  "Print & tempel ke buket atau kotak cokelat kamu!"

---

## New Page: `src/components/SharePage.tsx`

Public gift share page (no login required).

```ts
// Reads shareId from URL params (/gift/:shareId)
// GET /api/share/:shareId → { title, message, templateId, imageUrl, audioUrl }
```

Layout:
- Full-page warm gradient background (candlelight cream to light amber).
- Card centered (max-width 480px):
  - Gift card image at top (full width, rounded corners).
  - Message text below (italic, dark text, generous padding).
  - Large centered play button → plays audio inline.
  - Track title in small muted text.
  - Footer: "Dibuat dengan Lovemelodia 🎁 · lovemelodia.com" (small link).
- No navbar, no login prompt.
- Framer Motion fade-in on load.

---

## App Router Update (`src/App.tsx`)

Add route:
```tsx
<Route path="/gift/:shareId" element={<SharePage />} />
```

---

## Files Touched / Created

| File | Change type |
|------|-------------|
| `server/lib/db.ts` | Edit — add share_links table + prepared statements + exports |
| `server/lib/giftcard.ts` | New — gift card generation engine |
| `server/routes/giftcard.ts` | New — gift card API routes |
| `server/index.ts` | Edit — mount giftcard router + public share endpoint |
| `src/components/music/GiftCardCreator.tsx` | New — gift card creation UI |
| `src/components/SharePage.tsx` | New — public share page |
| `src/App.tsx` | Edit — add /gift/:shareId route |
| `scripts/generate-templates.ts` | New — one-time template PNG generator |
| `public/templates/*.png` | New — 12 template gradient PNGs (generated by script) |

---

## Acceptance Criteria
- [ ] `GET /api/giftcard/templates` returns 12 templates with id, label, color.
- [ ] Photo upload returns a GCS URL; Sharp resizes to 1080×1080 cover.
- [ ] `POST /api/giftcard/generate` returns 202 with shareId.
- [ ] After polling, all 3 assets exist in GCS.
- [ ] Feed PNG is 1080×1080, QR code visible bottom-right.
- [ ] Print tag PNG is 1004×650, message readable, QR scannable.
- [ ] Stories MP4 is 1080×1920, ~15s, has audio.
- [ ] `GET /api/share/:shareId` returns correct data without auth.
- [ ] SharePage loads at `/gift/{shareId}`, shows image + plays audio.
- [ ] "Copy Link" copies correct URL and shows confirmation.
- [ ] Print tag downloads correctly and QR code resolves to share URL.
