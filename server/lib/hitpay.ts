import crypto from "crypto";

const BASE_URL = "https://api.hit-pay.com/v1";

// TODO: Stripe — for multi-currency support, add a separate /api/payment/create-stripe-session route
// so HitPay (IDR) and Stripe (SGD/USD) can coexist without touching this file.
export const PACKAGES: Record<string, { name: string; credits: number; amount: number; currency: string }> = {
  starter:      { name: "Starter",   credits: 5,  amount: 15000, currency: "IDR" },
  creator:      { name: "Creator",   credits: 15, amount: 35000, currency: "IDR" },
  unlimited_mo: { name: "Unlimited", credits: 30, amount: 75000, currency: "IDR" },
};

function apiKey(): string {
  const k = process.env.HITPAY_API_KEY;
  if (!k) throw new Error("HITPAY_API_KEY not set");
  return k;
}

export interface HitPayPayment {
  id: string;
  url: string;
  status: string;
  reference_number: string;
}

export async function createPaymentRequest(params: {
  amount: number;
  currency: "IDR" | "SGD";
  purpose: string;
  referenceNumber: string;
  redirectUrl: string;
  webhookUrl: string;
}): Promise<HitPayPayment> {
  const body = new URLSearchParams({
    amount: params.amount.toFixed(2),
    currency: params.currency,
    purpose: params.purpose,
    reference_number: params.referenceNumber,
    redirect_url: params.redirectUrl,
    webhook: params.webhookUrl,
    send_sms: "0",
    send_email: "0",
    allow_repeated_payments: "0",
  });

  const res = await fetch(`${BASE_URL}/payment-requests`, {
    method: "POST",
    headers: {
      "X-BUSINESS-API-KEY": apiKey(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HitPay error (${res.status}): ${text}`);
  const data = JSON.parse(text) as { id: string; url: string; status: string; reference_number: string };
  return data;
}

export function verifyWebhookHmac(payload: Record<string, string>): boolean {
  const salt = process.env.HITPAY_SALT;
  if (!salt) throw new Error("HITPAY_SALT not set");
  const { hmac, ...rest } = payload;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map(k => `${k}${rest[k]}`)
    .join("|");
  const expected = crypto.createHmac("sha256", salt).update(message).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
}
