import { randomInt, createHmac, timingSafeEqual } from "crypto";
import { supabase } from "./supabase.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const memStore = new Map<string, { otp: string; expiresAt: number }>();

export function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

export async function storeOtp(phone: string, otp: string): Promise<void> {
  if (supabase) {
    const expires_at = new Date(Date.now() + OTP_TTL_MS).toISOString();
    await supabase.from("otp_store").upsert({ phone, otp, expires_at });
    return;
  }
  memStore.set(phone, { otp, expiresAt: Date.now() + OTP_TTL_MS });
}

export async function verifyOtp(phone: string, otp: string): Promise<boolean> {
  if (supabase) {
    const { data } = await supabase
      .from("otp_store")
      .select("otp, expires_at")
      .eq("phone", phone)
      .maybeSingle();
    if (!data) return false;
    if (new Date((data as { expires_at: string }).expires_at) < new Date()) {
      await supabase.from("otp_store").delete().eq("phone", phone);
      return false;
    }
    if ((data as { otp: string }).otp !== otp) return false;
    await supabase.from("otp_store").delete().eq("phone", phone);
    return true;
  }
  const entry = memStore.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) { memStore.delete(phone); return false; }
  if (entry.otp !== otp) return false;
  memStore.delete(phone);
  return true;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");

export function signToken(phone: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ phone, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 })).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET as string)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyToken(token: string): { phone: string } | null {
  try {
    const [header, payload, sig] = token.split(".");
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    const expected = createHmac("sha256", JWT_SECRET as string)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    return parsed;
  } catch {
    return null;
  }
}
