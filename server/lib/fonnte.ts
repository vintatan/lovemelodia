const FONNTE_API_KEY = process.env.FONNTE_API_KEY || "";
const FONNTE_API_URL = "https://api.fonnte.com";

const NON_ID_PREFIXES = [
  "1", "44", "65", "60", "61", "81", "82", "86", "91", "63",
  "66", "84", "33", "49", "39", "34", "7", "55", "971", "966",
  "852", "886",
];

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()+]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("0")) cleaned = "62" + cleaned.slice(1);
  if (cleaned.startsWith("6262")) cleaned = cleaned.slice(2);
  if (!/^\d{8,15}$/.test(cleaned)) {
    console.warn(`[Fonnte] Invalid phone: ${cleaned}`);
  }
  return cleaned;
}

function detectCountryCode(phone: string): string | undefined {
  for (const prefix of NON_ID_PREFIXES) {
    if (phone.startsWith(prefix)) return prefix;
  }
  return undefined;
}

async function fonntePost(endpoint: string, body: Record<string, string>) {
  const target = body.target;
  const countryCode = detectCountryCode(target);
  const formData = new URLSearchParams(body);
  if (countryCode) formData.set("countryCode", countryCode);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${FONNTE_API_URL}${endpoint}`, {
      method: "POST",
      headers: { Authorization: FONNTE_API_KEY },
      body: formData,
      signal: controller.signal,
    });
    const json = await res.json() as Record<string, unknown>;
    if (json.status === false || json.status === "false") {
      throw new Error(`[Fonnte] Send failed: ${json.reason || JSON.stringify(json)}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendWhatsAppText(phone: string, message: string) {
  const target = normalizePhone(phone);
  return fonntePost("/send", { target, message });
}
