import crypto from "crypto";

interface TokenCache { token: string; expiresAt: number }
let _cache: TokenCache | null = null;

function baseUrl(): string {
  return process.env.AIRWALLEX_ENV === "demo"
    ? "https://api-demo.airwallex.com"
    : "https://api.airwallex.com";
}

async function getToken(): Promise<string> {
  if (_cache && _cache.expiresAt > Date.now() + 60_000) return _cache.token;
  const clientId = process.env.AIRWALLEX_CLIENT_ID;
  const apiKey = process.env.AIRWALLEX_API_KEY;
  if (!clientId || !apiKey) throw new Error("AIRWALLEX_CLIENT_ID and AIRWALLEX_API_KEY must be set");

  const res = await fetch(`${baseUrl()}/api/v1/authentication/login`, {
    method: "POST",
    headers: { "x-client-id": clientId, "x-api-key": apiKey, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Airwallex auth failed (${res.status}): ${await res.text()}`);
  const data = await res.json() as { token: string; expires_at: string };
  _cache = { token: data.token, expiresAt: new Date(data.expires_at).getTime() };
  return _cache.token;
}

export interface PaymentLink {
  id: string; externalId: string; invoiceUrl: string; status: string; amount: number;
}

export async function createPaymentLink(params: {
  externalId: string; amount: number; currency: "IDR" | "SGD";
  description: string; returnUrl: string; cancelUrl: string;
}): Promise<PaymentLink> {
  const token = await getToken();
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  const res = await fetch(`${baseUrl()}/api/v1/pa/payment_links/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: params.description,
      currency: params.currency,
      amount: params.amount,
      reusable: false,
      merchant_order_id: params.externalId,
      order: { products: [{ name: params.description, quantity: 1, unit_price: params.amount }] },
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
      expires_at: expiresAt,
      customer: { country_code: "ID" },
      locale: "id",
      logo_url: `${process.env.APP_URL ?? ""}/logo.png`,
      payment_method_types: ["card", "bank_transfer"],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Airwallex payment link failed (${res.status}): ${body}`);
  const data = JSON.parse(body) as { id: string; url: string; status: string; amount: number };
  return { id: data.id, externalId: params.externalId, invoiceUrl: data.url, status: data.status, amount: data.amount };
}

export async function getPaymentLinkStatusById(linkId: string): Promise<string> {
  const token = await getToken();
  const res = await fetch(`${baseUrl()}/api/v1/pa/payment_links/${encodeURIComponent(linkId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Airwallex fetch failed (${res.status}): ${await res.text()}`);
  const data = await res.json() as { status: string };
  return data.status ?? "UNKNOWN";
}

export async function getPaymentLinkStatus(externalId: string): Promise<string> {
  const token = await getToken();
  const res = await fetch(`${baseUrl()}/api/v1/pa/payment_links?merchant_order_id=${encodeURIComponent(externalId)}&page_size=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Airwallex fetch failed (${res.status}): ${await res.text()}`);
  const data = await res.json() as { items?: { status: string }[] };
  return data.items?.[0]?.status ?? "UNKNOWN";
}

export function verifyWebhook(signature: string, rawBody: string): boolean {
  const secret = process.env.AIRWALLEX_WEBHOOK_SECRET;
  if (!secret) throw new Error("AIRWALLEX_WEBHOOK_SECRET not set");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
