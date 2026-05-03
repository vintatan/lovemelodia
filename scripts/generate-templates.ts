/**
 * One-time setup script: generate 1080×1080 gradient PNG templates for gift cards.
 * Run: npx tsx scripts/generate-templates.ts
 * Output: public/templates/{templateId}.png
 */
import sharp from "sharp";
import path from "path";
import fs from "fs";

const TEMPLATES = [
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

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

function darken(hex: string, factor = 0.4): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

const outDir = path.resolve("public/templates");
fs.mkdirSync(outDir, { recursive: true });

for (const template of TEMPLATES) {
  const dark = darken(template.color, 0.4);
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${template.color};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${dark};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#grad)"/>
    <text x="540" y="540" font-family="Arial, sans-serif" font-size="72"
      font-weight="bold" fill="rgba(255,255,255,0.2)" text-anchor="middle"
      dominant-baseline="middle">${template.label}</text>
  </svg>`;

  const outPath = path.join(outDir, `${template.id}.png`);
  await sharp(Buffer.from(svgStr)).resize(1080, 1080).png().toFile(outPath);
  console.log(`Generated: ${outPath}`);
}

console.log("All templates generated.");
