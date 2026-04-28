import { Router } from "express";
import { nanoid } from "nanoid";
import { getOrCreateUserAsync, getCredits, createTransaction, getTransactionByExternalIdAsync, markPaidAndCredit, redeemFreePromo } from "../lib/db.js";
import { createPaymentLink, getPaymentLinkStatus } from "../lib/airwallex.js";
import { trackPaymentCompleted } from "../lib/supabase.js";

const router = Router();

const PACKAGES = [
  { name: "starter", credits: 200, amountIdr: 25000, amountSgd: 3 },
  { name: "creator", credits: 500, amountIdr: 55000, amountSgd: 6 },
  { name: "pro",     credits: 1200, amountIdr: 115000, amountSgd: 12 },
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
    const link = await createPaymentLink({
      externalId,
      amount,
      currency: currency as "IDR" | "SGD",
      description: `Kreasi AI ${pkg.credits} Credits`,
      returnUrl: `${appUrl}?payment=success&ext=${externalId}`,
      cancelUrl: `${appUrl}?payment=cancelled`,
    });

    createTransaction({
      id: nanoid(), phone, externalId, packageName: pkg.name,
      credits: pkg.credits, amount, currency,
    });

    return res.json({ paymentUrl: link.invoiceUrl, externalId });
  } catch (err: any) {
    console.error("[Credits] purchase error:", err);
    return res.status(500).json({ error: "Payment creation failed" });
  }
});

router.post("/verify-payment", async (req, res) => {
  const phone = req.user!.phone;
  const { externalId } = req.body as { externalId?: string };
  if (!externalId) return res.status(400).json({ error: "externalId required" });

  const tx = await getTransactionByExternalIdAsync(externalId);
  if (!tx || tx.phone !== phone) return res.status(404).json({ error: "Transaction not found" });
  if (tx.status === "PAID") return res.json({ status: "PAID", credits: getCredits(phone) });

  const status = await getPaymentLinkStatus(externalId);
  if (status === "SUCCEEDED") {
    const granted = markPaidAndCredit(externalId);
    if (granted) trackPaymentCompleted(tx as any);
    return res.json({ status: "PAID", credits: getCredits(phone) });
  }
  return res.json({ status });
});

router.post("/redeem-promo", async (req, res) => {
  const phone = req.user!.phone;
  const { code } = req.body as { code?: string };
  if (!code) return res.status(400).json({ error: "Promo code required" });

  const PROMO_MAP: Record<string, number> = {
    KREASI100: 100,
    KREASI50:  50,
  };
  const credits = PROMO_MAP[code.toUpperCase()];
  if (!credits) return res.status(400).json({ error: "Invalid promo code" });

  const result = await redeemFreePromo(phone, code.toUpperCase(), credits);
  if (!result.success) return res.status(409).json({ error: result.reason });
  return res.json({ success: true, creditsAdded: credits, credits: getCredits(phone) });
});

export default router;
