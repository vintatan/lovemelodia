# Phase M3.2 — Custom Photo Background

## Goal
Ensure the custom photo upload path in GiftCardCreator produces a clean, well-cropped
1080×1080 output for all common photo shapes and sizes. This phase covers edge cases
not tested during M3.1's initial wiring.

---

## Background

M3.1 introduced the photo upload route (`POST /api/giftcard/upload-photo`) and the
corresponding Sharp resize in `server/lib/giftcard.ts`. This phase validates that all
photo orientations and sizes produce a usable gift card background.

---

## Backend: `server/lib/giftcard.ts`

### Photo Handling (confirm + harden)

The photo processing pipeline in `generateGiftCard` when `photoUrl` is provided:

```ts
const photoResp = await fetch(photoUrl);
const photoBuf = Buffer.from(await photoResp.arrayBuffer());

const bgBuffer = await sharp(photoBuf)
  .rotate()                             // auto-rotate per EXIF orientation
  .resize(1080, 1080, {
    fit: "cover",
    position: "centre",                 // crop to center square
    withoutEnlargement: false,          // allow upscaling small photos
  })
  .toBuffer();
```

Key behaviours to verify:
1. **Portrait photo (e.g. 1080×1920)** — crops top/bottom, fills 1080×1080. Subject
   should remain centered.
2. **Landscape photo (e.g. 1920×1080)** — crops left/right, fills 1080×1080.
3. **Small photo (<500px wide)** — upscaled to 1080×1080 with `cover` fit. Result
   may be blurry but should not error or produce black bars.
4. **JPEG with EXIF rotation** — `.rotate()` corrects orientation before resize.
5. **PNG with transparency** — flatten alpha channel to white before compositing:
   ```ts
   .flatten({ background: { r: 255, g: 255, b: 255 } })
   .rotate()
   .resize(...)
   ```

Add the `.flatten()` call before `.rotate()` in the pipeline to handle PNG transparency.

### Upload Route (`POST /api/giftcard/upload-photo`)

Validate accepted mimetypes explicitly:
```ts
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];
if (!ACCEPTED_IMAGE_TYPES.includes(req.file.mimetype)) {
  return res.status(400).json({ error: "Format foto tidak didukung. Gunakan JPG, PNG, atau WebP." });
}
```

HEIC note: Sharp supports HEIC via libvips on Linux. If the deployment environment
does not have HEIC support compiled in, catch the Sharp error and return:
`"Format HEIC belum didukung — silakan convert ke JPG terlebih dahulu."`

File size limit: 10MB for photos (higher than voice recordings).
```ts
upload.single("photo")  // multer with limits: { fileSize: 10 * 1024 * 1024 }
```

---

## Frontend: `src/components/music/GiftCardCreator.tsx`

### Upload UI Polish

**File input trigger:**
- The "📷 Foto Kamu" tile should also accept drag-and-drop (desktop).
  Wrap the tile in a drop zone that calls `uploadPhoto(file)` on `drop`.
- On mobile, `<input type="file" accept="image/*" capture="environment">` allows
  choosing from camera roll or taking a live photo.

**Upload state feedback:**
- While uploading: show a loading spinner overlay on the photo tile.
- On success: show a small thumbnail of the uploaded image in the tile, with a
  `✕` button in the corner to remove and revert to template selection.
- On error: show a brief toast error message (2s) below the tile.

**File size pre-check (client-side):**
```ts
if (file.size > 10 * 1024 * 1024) {
  showError("Foto terlalu besar (maks. 10MB)");
  return;
}
```

**Accepted types (client-side `accept` attribute):**
```html
<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" />
```

---

## Test Checklist

| Input | Expected output |
|-------|----------------|
| Portrait JPEG 1080×1920 | Clean 1080×1080 center crop, no bars |
| Landscape JPEG 1920×1080 | Clean 1080×1080 center crop, no bars |
| Square JPEG 500×500 | Upscaled 1080×1080, no bars, slight blur OK |
| Portrait PNG with transparency | Transparent areas filled white, clean crop |
| JPEG with EXIF rotation (rotated 90°) | Corrected orientation, then cropped |
| HEIC (iOS) | Either processes or returns clear error message |
| File > 10MB | Client-side rejection before upload |
| Non-image file | Server rejects with 400 |

---

## Files Touched

| File | Change type |
|------|-------------|
| `server/lib/giftcard.ts` | Edit — add `.flatten()` + EXIF `.rotate()` to photo pipeline |
| `server/routes/giftcard.ts` | Edit — stricter mimetype validation + 10MB limit |
| `src/components/music/GiftCardCreator.tsx` | Edit — drag-and-drop, thumbnail preview, remove button, client-side size check |

---

## Acceptance Criteria
- [ ] Portrait photo produces clean 1080×1080 center crop.
- [ ] Landscape photo produces clean 1080×1080 center crop.
- [ ] Small (<500px) photo upscales without error.
- [ ] PNG with transparency fills white, no black corners in feed image.
- [ ] EXIF-rotated JPEG displays correctly in final gift card.
- [ ] Files >10MB are rejected client-side with clear message.
- [ ] Non-image files return server 400 with descriptive error.
- [ ] Photo tile shows thumbnail preview with remove button.
- [ ] Removing photo reverts to template-based background.
