import { Router } from "express";
import { nanoid } from "nanoid";
import { getOrCreateUserAsync, getCredits, deductCreditsAsync, createTransaction, markPaidAndCredit, redeemFreePromo, hasRedeemedPromo } from "../lib/db.js";
import { createPaymentLink } from "../lib/airwallex.js";
import { trackPaymentCompleted, hasRedeemedPromoInSupabase } from "../lib/supabase.js";

const router = Router();

const PROMO_MAP: Record<string, number> = {
  KREASI100: 100,
  KREASI50:  50,
  IMAJIEASY: 50,
};

const PACKAGES = [
  { name: "starter", credits: 20,  amountIdr: 10_000,  amountSgd: 1  },
  { name: "creator", credits: 50,  amountIdr: 55_000,  amountSgd: 6  },
  { name: "studio",  credits: 120, amountIdr: 115_000, amountSgd: 12 },
];

router.get("/balance", async (req, res) => {
  const phone = req.user!.phone;
  const user = await getOrCreateUserAsync(phone);
  return res.json({ credits: user.credits, phone });
});

router.get("/packages", (_req, res) => {
  return res.json({ packages: PACKAGES });
});

router.post("/purchase", async (req, res) => {
  const phone = req.user!.phone;
  const { packageName, currency = "IDR" } = req.body as { packageName?: string; currency?: string };
  const pkg = PACKAGES.find(p => p.name === packageName);
  if (!pkg) return res.status(400).json({ error: "Invalid package" });

  const externalId = `kreasi-${nanoid()}`;
  const amount = currency === "SGD" ? pkg.amountSgd : pkg.amountIdr;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  try {
    const payment = await createPaymentLink({
      externalId,
      amount,
      currency: currency as "IDR" | "SGD",
      description: `Kreasi AI ${pkg.name} — ${pkg.credits} credits`,
      returnUrl: `${appUrl}?payment=success&ext=${externalId}`,
      cancelUrl: `${appUrl}?payment=cancelled`,
    });

    createTransaction({
      id: nanoid(), phone, externalId, packageName: pkg.name,
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

export default router;
