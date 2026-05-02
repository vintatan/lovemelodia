import { Router } from "express";
import { normalizePhone, sendWhatsAppText } from "../lib/fonnte.js";
import { generateOtp, storeOtp, verifyOtp, signToken } from "../lib/otp.js";
import { getOrCreateUserAsync } from "../lib/db.js";
import { recordLogin } from "../lib/supabase.js";
import { bqTrackWhatsApp } from "../lib/bigquery.js";
import { otpRateLimit } from "../middleware/rateLimit.js";

const router = Router();
const IS_DEV = process.env.NODE_ENV !== "production";

router.post("/send-otp", otpRateLimit, async (req, res) => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ error: "Phone number required" });
    }
    const normalized = normalizePhone(phone);
    if (normalized.length < 8) {
      return res.status(400).json({ error: "Invalid phone number" });
    }
    const otp = generateOtp();
    await storeOtp(normalized, otp);
    if (IS_DEV) console.log(`\n[Auth] DEV OTP for ${normalized}: ${otp}\n`);

    const message =
      `*${otp}* adalah kode login Kreasi AI Anda. Berlaku 5 menit.\n\n` +
      `*${otp}* is your Kreasi AI login code. Valid for 5 minutes.`;

    res.json({ success: true, phone: normalized });

    sendWhatsAppText(normalized, message).catch(err => {
      console.error("[Auth] WhatsApp send failed:", err);
    });
    bqTrackWhatsApp({ phone: normalized, eventType: "otp_sent" });
  } catch (err) {
    console.error("[Auth] send-otp error:", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
});

router.post("/verify-otp", otpRateLimit, async (req, res) => {
  const { phone, otp } = req.body as { phone?: string; otp?: string };
  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone and OTP required" });
  }
  const normalized = normalizePhone(phone);
  const valid = await verifyOtp(normalized, otp);
  if (!valid) {
    return res.status(401).json({ error: "Invalid or expired OTP" });
  }
  const user = await getOrCreateUserAsync(normalized);
  recordLogin(normalized).catch(() => {});
  bqTrackWhatsApp({ phone: normalized, eventType: "login" });
  const token = signToken(normalized);
  return res.json({ success: true, token, phone: normalized, credits: user.credits });
});

export default router;
