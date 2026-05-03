import { Router } from "express";
import { nanoid } from "nanoid";
import { getOrCreateUserAsync, getCredits, deductCreditsAsync, createTransaction, markPaidAndCredit, getTransactionByExternalIdAsync, redeemFreePromo, hasRedeemedPromo } from "../lib/db.js";
import { createPaymentLink, getPaymentLinkStatus, getPaymentLinkStatusById } from "../lib/airwallex.js";
import { createPaymentRequest, PACKAGES } from "../lib/hitpay.js";
import { trackPaymentCompleted, hasRedeemedPromoInSupabase } from "../lib/supabase.js";

const router = Router();

const PROMO_MAP: Record<string, number> = {
  KREASI100: 100,
  KREASI50:  50,
  IMAJIEASY: 50,
};

// PACKAGES is now defined in server/lib/hitpay.ts and imported above.

router.get("/balance", async (req, res) => {
  const phone = req.user!.phone;
  const user = await getOrCreateUserAsync(phone);
  return res.json({ credits: user.credits, phone });
});

router.get("/packages", (_req, res) => {
  return res.json({ packages: PACKAGES });
});

// POST /api/credits/create-link — create a HitPay payment link for a credit package
// TODO: Stripe — add /api/payment/create-stripe-session for multi-currency (SGD/USD) support
router.post("/create-link", async (req, res) => {
  const phone = req.user!.phone;
  const { packageId } = req.body as { packageId?: string };
  const pkg = packageId ? PACKAGES[packageId] : undefined;
  if (!pkg) return res.status(400).json({ error: "Invalid packageId" });

  const externalId = `lm-${nanoid()}`;
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, "") || "";
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0].trim() ?? req.protocol;
  const appUrl = origin || process.env.APP_URL || `${proto}://${req.get("host")}`;

  try {
    const payment = await createPaymentRequest({
      amount: pkg.amount,
      currency: pkg.currency as "IDR" | "SGD",
      purpose: `Lovemelodia ${pkg.name} — ${pkg.credits} credits`,
      referenceNumber: externalId,
      redirectUrl: `${appUrl}?payment=success&ext=${externalId}`,
      webhookUrl: `${appUrl}/api/webhooks/hitpay`,
    });

    createTransaction({
      id: nanoid(), phone, externalId, linkId: payment.id,
      packageName: packageId!, credits: pkg.credits, amount: pkg.amount, currency: pkg.currency,
    });

    return res.json({ url: payment.url, externalId });
  } catch (err: any) {
    console.error("[Credits] create-link error:", err);
    return res.status(500).json({ error: "Payment creation failed" });
  }
});

// Legacy Airwallex purchase route — kept for backward compat, superseded by /create-link (HitPay)
router.post("/purchase", async (req, res) => {
  const phone = req.user!.phone;
  const { packageName, currency = "IDR" } = req.body as { packageName?: string; currency?: string };
  const pkg = packageName ? PACKAGES[packageName] : undefined;
  if (!pkg) return res.status(400).json({ error: "Invalid package" });

  const externalId = `kreasi-${nanoid()}`;
  const amount = pkg.amount;
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, "") || "";
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0].trim() ?? req.protocol;
  const appUrl = origin || process.env.APP_URL || `${proto}://${req.get("host")}`;

  try {
    const payment = await createPaymentLink({
      externalId,
      amount,
      currency: currency as "IDR" | "SGD",
      description: `Lovemelodia ${pkg.name} — ${pkg.credits} credits`,
      returnUrl: `${appUrl}?payment=success&ext=${externalId}`,
      cancelUrl: `${appUrl}?payment=cancelled`,
    });

    createTransaction({
      id: nanoid(), phone, externalId, linkId: payment.id, packageName: packageName!,
      credits: pkg.credits, amount, currency,
    });

    return res.json({ paymentUrl: payment.invoiceUrl, externalId });
  } catch (err: any) {
    console.error("[Credits] purchase error:", err);
    return res.status(500).json({ error: "Payment creation failed" });
  }
});

// Called by imaji-mcp before each paid tool call — service JWT required
router.post("/deduct", async (req, res) => {
  if (!(req as any).servicePhone) return res.status(403).json({ error: "Service authorization required" });
  const { amount } = req.body as { amount?: number };
  if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ error: "amount required" });
  const phone = req.user!.phone;
  const user = await getOrCreateUserAsync(phone);
  if (user.credits < amount) {
    return res.status(402).json({ error: "Kredit tidak cukup", credits: user.credits });
  }
  const deducted = await deductCreditsAsync(phone, amount);
  if (!deducted) return res.status(402).json({ error: "Kredit tidak cukup", credits: getCredits(phone) });
  return res.json({ credits: getCredits(phone) });
});

// GET /api/credits/promo-status — check if authenticated user has redeemed the free promo
router.get("/promo-status", async (req, res) => {
  const phone = req.user!.phone;
  const code = "IMAJIEASY";
  if (hasRedeemedPromo(phone, code)) return res.json({ redeemed: true });
  const redeemedInSupabase = await hasRedeemedPromoInSupabase(phone, code);
  return res.json({ redeemed: redeemedInSupabase });
});

router.post("/redeem-promo", async (req, res) => {
  const phone = req.user!.phone;
  const { code } = req.body as { code?: string };
  if (!code) return res.status(400).json({ error: "Promo code required" });

  const credits = PROMO_MAP[code.toUpperCase()];
  if (!credits) return res.status(400).json({ error: "Invalid promo code" });

  const result = await redeemFreePromo(phone, code.toUpperCase(), credits);
  if (!result.success) return res.status(409).json({ error: result.reason });
  return res.json({ success: true, creditsAdded: credits, credits: getCredits(phone) });
});

// POST /api/credits/verify-payment — webhook fallback, called by frontend on return from Airwallex
router.post("/verify-payment", async (req, res) => {
  const { externalId } = req.body as { externalId?: string };
  if (!externalId || typeof externalId !== "string" || !externalId.startsWith("kreasi-")) {
    return res.status(400).json({ error: "Invalid externalId" });
  }

  const tx = await getTransactionByExternalIdAsync(externalId);
  if (!tx) return res.status(404).json({ error: "Transaction not found" });
  if (tx.status === "PAID") return res.json({ status: "PAID", credits: getCredits(tx.phone) });

  try {
    const status = tx.link_id
      ? await getPaymentLinkStatusById(tx.link_id)
      : await getPaymentLinkStatus(externalId);
    if (status === "SUCCEEDED" || status === "PAID") {
      const credited = markPaidAndCredit(externalId);
      if (credited) {
        console.log(`[verify-payment] Credited ${tx.credits} to ${tx.phone} via poll (${externalId})`);
        trackPaymentCompleted(tx as any);
      }
      return res.json({ status: "PAID", credits: getCredits(tx.phone) });
    }
    return res.json({ status, credits: getCredits(tx.phone) });
  } catch (err) {
    console.error("[verify-payment] error:", err);
    return res.status(500).json({ error: "Failed to verify payment" });
  }
});

export default router;
