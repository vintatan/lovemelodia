import sharp from "sharp";
import QRCode from "qrcode";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execPromise = promisify(exec);

// ── Templates ──────────────────────────────────────────────────────────────────

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

// ── Hex to RGB helper ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

function darken(hex: string, factor = 0.5): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

// ── SVG text helpers ───────────────────────────────────────────────────────────

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxChars) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function messageSvg(text: string, width: number, size: number): string {
  const lines = wrapText(text, 28);
  const lineHeight = size * 1.4;
  const startY = 140;
  const tspans = lines
    .map((line, i) => `<tspan x="${width / 2}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1080">
    <text x="${width / 2}" y="${startY}" font-family="Arial, sans-serif" font-size="${size}"
      font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="hanging"
      filter="url(#shadow)">
      ${tspans}
    </text>
    <defs>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.6)"/>
      </filter>
    </defs>
  </svg>`;
}

function titleSvg(text: string, width: number, size: number): string {
  const safe = escapeXml(text);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1080">
    <text x="${width / 2}" y="260" font-family="Arial, sans-serif" font-size="${size}"
      font-style="italic" fill="rgba(255,255,255,0.85)" text-anchor="middle">
      ${safe}
    </text>
  </svg>`;
}

function watermarkSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
    <text x="40" y="1055" font-family="Arial, sans-serif" font-size="24"
      fill="rgba(255,255,255,0.5)">lovemelodia.com</text>
  </svg>`;
}

function accentBorderSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1004" height="650">
    <rect width="8" height="650" fill="${escapeXml(color)}"/>
  </svg>`;
}

function printTextSvg(message: string, title: string, brandColor: string): string {
  const msgLines = wrapText(message, 22);
  const lineHeight = 52;
  const msgTspans = msgLines
    .map((line, i) => `<tspan x="530" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1004" height="650">
    <text x="530" y="180" font-family="Arial, sans-serif" font-size="42"
      font-weight="bold" fill="#111111">
      ${msgTspans}
    </text>
    <text x="530" y="400" font-family="Arial, sans-serif" font-size="28" fill="#555555">
      Scan untuk dengerin ♪
    </text>
    <text x="530" y="450" font-family="Arial, sans-serif" font-size="22" fill="#888888"
      font-style="italic">${escapeXml(title ?? "")}</text>
    <text x="530" y="600" font-family="Arial, sans-serif" font-size="22"
      fill="${escapeXml(brandColor)}">lovemelodia.com</text>
  </svg>`;
}

function holePunchSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1004" height="650">
    <circle cx="970" cy="40" r="20" fill="none" stroke="#CCCCCC" stroke-width="2"/>
  </svg>`;
}

// ── Template background generator ─────────────────────────────────────────────

export async function generateTemplateBackground(templateId: string): Promise<Buffer> {
  const template = TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES[0];
  const dark = darken(template.color, 0.4);
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${template.color};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${dark};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#grad)"/>
  </svg>`;
  return sharp(Buffer.from(svgStr)).resize(1080, 1080).png().toBuffer();
}

// ── Main gift card generator ───────────────────────────────────────────────────

export interface GiftCardParams {
  musicJob: { id: string; audio_url: string | null; title: string | null };
  templateId: string;
  message: string;
  shareId: string;
  photoUrl?: string;
}

export interface GiftCardResult {
  feedBuffer: Buffer;
  printBuffer: Buffer;
  storiesPath: string;
  audioPath: string;
}

export async function generateGiftCardAssets(params: GiftCardParams): Promise<GiftCardResult> {
  const { musicJob, templateId, message, shareId, photoUrl } = params;
  const trackTitle = musicJob.title ?? "Lagu Untukmu";

  // Step 1: Fetch audio if available
  let audioPath: string | null = null;
  if (musicJob.audio_url) {
    try {
      const audioResp = await fetch(musicJob.audio_url);
      if (audioResp.ok) {
        const audioBuffer = await audioResp.arrayBuffer();
        audioPath = `/tmp/${musicJob.id}-audio.wav`;
        fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
      }
    } catch {
      // audio fetch failed — proceed without audio for video
    }
  }

  // Step 2: Load or generate background
  let bgBuffer: Buffer;
  if (photoUrl) {
    const photoResp = await fetch(photoUrl);
    const photoBuf = await photoResp.arrayBuffer();
    bgBuffer = await sharp(Buffer.from(photoBuf))
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // flatten PNG transparency to white
      .rotate()                                               // auto-rotate per EXIF orientation
      .resize(1080, 1080, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: false, // allow upscaling small photos
      })
      .toBuffer();
  } else {
    bgBuffer = await generateTemplateBackground(templateId);
  }

  // Step 3: Generate QR code
  const qrBuffer = await QRCode.toBuffer(
    `https://lovemelodia.com/gift/${shareId}`,
    { width: 400, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } },
  );

  // Step 4: Compose feed image (1080×1080)
  const feedPath = `/tmp/${shareId}-feed.png`;
  const qr200 = await sharp(qrBuffer).resize(200, 200).toBuffer();
  await sharp(bgBuffer)
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">` +
          `<rect width="1080" height="1080" fill="rgba(0,0,0,0.4)"/></svg>`,
        ),
        blend: "over",
      },
      { input: qr200, top: 840, left: 840 },
      { input: Buffer.from(messageSvg(message, 1080, 52)), blend: "over" },
      { input: Buffer.from(titleSvg(trackTitle, 1080, 38)), blend: "over" },
      { input: Buffer.from(watermarkSvg()), blend: "over" },
    ])
    .toFile(feedPath);

  const feedBuffer = fs.readFileSync(feedPath);

  // Step 5: Compose print tag (1004×650)
  const printPath = `/tmp/${shareId}-print.png`;
  const template = TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES[0];
  const qr400 = await sharp(qrBuffer).resize(400, 400).toBuffer();

  await sharp({
    create: {
      width: 1004,
      height: 650,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: Buffer.from(accentBorderSvg(template.color)), blend: "over" },
      { input: qr400, top: 125, left: 50 },
      { input: Buffer.from(printTextSvg(message, trackTitle, template.color)), blend: "over" },
      { input: Buffer.from(holePunchSvg()), blend: "over" },
    ])
    .png()
    .toFile(printPath);

  const printBuffer = fs.readFileSync(printPath);

  // Step 6: Generate Stories video (1080×1920, 15s) — write to temp path
  const storiesPath = `/tmp/${shareId}-stories.mp4`;
  try {
    const audioInput = audioPath ? `-i "${audioPath}"` : "";
    const audioOutput = audioPath ? `-c:a aac -b:a 192k` : "-an";
    await execPromise(
      `ffmpeg -y -loop 1 -i "${feedPath}" ${audioInput} ` +
      `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" ` +
      `-c:v libx264 ${audioOutput} -t 15 -pix_fmt yuv420p "${storiesPath}"`,
    );
  } catch (err) {
    console.error("[giftcard] ffmpeg failed:", err);
    // Write empty placeholder so we can still return
    fs.writeFileSync(storiesPath, Buffer.alloc(0));
  }

  return { feedBuffer, printBuffer, storiesPath, audioPath: audioPath ?? "" };
}

export function cleanupTmpFiles(paths: string[]): void {
  for (const p of paths) {
    try { if (p) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}

// ── Vinyl Assets ───────────────────────────────────────────────────────────────

export interface VinylParams {
  shareId: string;
  occasionLabel: string;    // e.g. "Anniversary"
  recipientName?: string;   // optional, shown on center label
  trackTitle?: string;      // shown on vinyl label
  templateColor: string;    // hex color for center label accent
  audioUrl: string;         // for the QR scan destination
}

export interface VinylResult {
  vinylCardBuffer: Buffer;
  vinylVideoPath: string;
}

export async function generateVinylAssets(params: VinylParams): Promise<VinylResult> {
  const { shareId, occasionLabel, recipientName, trackTitle, templateColor, audioUrl: _audioUrl } = params;
  const SIZE = 1480;
  const CENTER = SIZE / 2;

  // ── Step 1: Generate QR code ────────────────────────────────────────────────
  const qrBuffer = await QRCode.toBuffer(
    `https://lovemelodia.com/gift/${shareId}`,
    { width: 180, margin: 0, color: { dark: "#1a0a0a", light: "#FFFFFF" } },
  );

  // ── Step 2: Build vinyl SVG ─────────────────────────────────────────────────
  const discRadius = 600;
  const labelRadius = 140;
  const labelInnerRadius = 110;
  const holeRadius = 18;
  const darkColor = darken(templateColor, 0.6);

  // Groove rings
  const grooveRadii = [560, 500, 440, 380, 320, 270, 220, 180];
  const grooveRings = grooveRadii
    .map(r => `<circle cx="${CENTER}" cy="${CENTER}" r="${r}" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="2"/>`)
    .join("\n    ");

  // Label text nodes
  const labelCX = CENTER;
  const labelCY = CENTER;
  const roseGold = "#E0B882";
  const displayName = escapeXml((recipientName ?? occasionLabel).slice(0, 20));
  const displayTrack = escapeXml((trackTitle ?? "Lagu Untukmu").slice(0, 22));

  const vinylSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <!-- Dark background -->
  <rect width="${SIZE}" height="${SIZE}" fill="#1A1A1A"/>

  <!-- Outer disc -->
  <circle cx="${CENTER}" cy="${CENTER}" r="${discRadius}" fill="#1A1A1A"/>

  <!-- Radial highlight arc (upper-left sheen) -->
  <path d="M ${CENTER - discRadius * 0.6} ${CENTER - discRadius * 0.6}
           A ${discRadius} ${discRadius} 0 0 1 ${CENTER + discRadius * 0.3} ${CENTER - discRadius * 0.85}"
    fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="40" stroke-linecap="round"/>

  <!-- Groove rings -->
  ${grooveRings}

  <!-- Center label circle -->
  <circle cx="${labelCX}" cy="${labelCY}" r="${labelRadius}" fill="${escapeXml(templateColor)}"/>
  <!-- Center label inner circle (darker) -->
  <circle cx="${labelCX}" cy="${labelCY}" r="${labelInnerRadius}" fill="${escapeXml(darkColor)}"/>

  <!-- Center hole -->
  <circle cx="${labelCX}" cy="${labelCY}" r="${holeRadius}" fill="#111111"/>

  <!-- Label text: LOVEMELODIA -->
  <text x="${labelCX}" y="${labelCY - 20}" font-family="Arial, sans-serif" font-size="28"
    font-weight="bold" fill="${roseGold}" text-anchor="middle" dominant-baseline="middle">LOVEMELODIA</text>

  <!-- Label text: recipient/occasion -->
  <text x="${labelCX}" y="${labelCY + 5}" font-family="Arial, sans-serif" font-size="22"
    fill="white" text-anchor="middle" dominant-baseline="middle">${displayName}</text>

  <!-- Label text: track title -->
  <text x="${labelCX}" y="${labelCY + 28}" font-family="Arial, sans-serif" font-size="18"
    fill="rgba(255,255,255,0.6)" text-anchor="middle" dominant-baseline="middle">${displayTrack}</text>

  <!-- Bottom watermark -->
  <text x="${CENTER}" y="${SIZE - 30}" font-family="Arial, sans-serif" font-size="22"
    fill="${roseGold}" text-anchor="middle" opacity="0.7">lovemelodia.com</text>
</svg>`;

  // ── Step 3: Composite QR onto center label ──────────────────────────────────
  // QR positioned at center, just above label texts (shifted up ~45px)
  const qrLeft = CENTER - 90;   // 90 = 180/2
  const qrTop  = CENTER - 90 - 45;

  const vinylCardBuffer = await sharp(Buffer.from(vinylSvg))
    .composite([
      {
        input: qrBuffer,
        left: Math.round(qrLeft),
        top: Math.round(qrTop),
      },
    ])
    .png()
    .toBuffer();

  // ── Step 4: Write vinyl PNG to /tmp ─────────────────────────────────────────
  const vinylPngPath = `/tmp/${shareId}-vinyl.png`;
  fs.writeFileSync(vinylPngPath, vinylCardBuffer);

  // ── Step 5: Generate animated vinyl video (1080×1920, 15s, 9:16) ───────────
  const vinylVideoPath = `/tmp/${shareId}-vinyl-video.mp4`;
  try {
    await execPromise(
      `ffmpeg -y -loop 1 -i "${vinylPngPath}" ` +
      `-vf "scale=900:900,` +
      `rotate=angle='2*PI*t/8':ow=iw:oh=ih:c=0x1A1A1A00,` +
      `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#1A1A1A" ` +
      `-c:v libx264 -an -t 15 -pix_fmt yuv420p -r 30 "${vinylVideoPath}"`,
    );
  } catch (err) {
    console.error("[giftcard] vinyl ffmpeg failed:", err);
    fs.writeFileSync(vinylVideoPath, Buffer.alloc(0));
  }

  // Cleanup vinyl png temp file
  try { fs.unlinkSync(vinylPngPath); } catch { /* ignore */ }

  return { vinylCardBuffer, vinylVideoPath };
}
