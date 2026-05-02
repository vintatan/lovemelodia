import { Router } from "express";
import { verifyWebhook } from "../lib/airwallex.js";
import { verifyWebhookHmac } from "../lib/hitpay.js";
import { getTransactionByExternalIdAsync, markPaidAndCredit } from "../lib/db.js";
import { trackPaymentCompleted } from "../lib/supabase.js";

const router = Router();

router.post("/hitpay", async (req, res) => {
  try {
    const payload = req.body as Record<string, string>;
    if (!verifyWebhookHmac(payload)) {
      return res.status(401).json({ error: "Invalid HMAC" });
    }
    const { reference_number, status } = payload;
    if (status !== "completed") return res.json({ received: true });

    const tx = await getTransactionByExternalIdAsync(reference_number);
    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    const granted = markPaidAndCredit(reference_number);
    if (granted) trackPaymentCompleted(tx as any);
    return res.json({ received: true });
  } catch (err: any) {
    console.error("[Webhook] HitPay error:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

router.post("/airwallex", async (req: any, res) => {
  try {
    const signature = (req.headers["x-signature"] as string) ?? "";
    const rawBody = req.rawBody as string;
    if (!verifyWebhook(signature, rawBody)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const event = req.body as { data?: { object?: { merchant_order_id?: string; status?: string } } };
    const externalId = event.data?.object?.merchant_order_id;
    const rawStatus = event.data?.object?.status;
    if (!externalId || rawStatus !== "SUCCEEDED") {
      return res.json({ received: true });
    }

    const tx = await getTransactionByExternalIdAsync(externalId);
    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    const granted = markPaidAndCredit(externalId);
    if (granted) trackPaymentCompleted(tx as any);

    return res.json({ received: true });
  } catch (err: any) {
    console.error("[Webhook] Airwallex error:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
