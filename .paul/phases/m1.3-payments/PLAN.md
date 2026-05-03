# Phase M1.3 — Payment Integration

## Goal
Wire up HitPay for IDR credit purchases. The kreasi-ai codebase already contains
a working HitPay integration — this phase adapts it to Lovemelodia's new package
definitions and confirms webhook handling is correct.

---

## Background: HitPay in kreasi-ai

kreasi-ai flow (reference only, do not break):
1. Frontend calls `POST /api/payment/create-link` with `{ packageId }`.
2. Server calls HitPay API to create a payment link → returns `{ url }`.
3. User is redirected to HitPay checkout.
4. HitPay sends a POST to `POST /api/webhooks/hitpay` with payment status.
5. Webhook verifies HMAC signature, calls `markPaidAndCredit(externalId)`.

---

## Changes

### 1. `server/lib/hitpay.ts` (if exists) or inline in payment route

Update the `PACKAGES` constant / object to match M1.2 definitions:

```ts
export const PACKAGES: Record<string, { name: string; credits: number; amount: number; currency: string }> = {
  starter:      { name: "Starter",       credits: 5,  amount: 15000,  currency: "IDR" },
  creator:      { name: "Creator",       credits: 15, amount: 35000,  currency: "IDR" },
  unlimited_mo: { name: "Unlimited",     credits: 30, amount: 75000,  currency: "IDR" },
};
```

- Remove any kreasi-ai-era package IDs that no longer apply.
- Keep currency as `"IDR"` — HitPay supports IDR natively.

---

### 2. `server/routes/webhook.ts`

**Review and confirm:**
- HMAC signature verification uses `HITPAY_SALT` env var (same as kreasi-ai).
- `markPaidAndCredit(externalId)` from `db.ts` is called on successful payment.
- Idempotency: `markPaidAndCredit` checks `tx.status === 'PAID'` before granting
  credits — already safe for duplicate webhooks.

**What to update:**
- No structural changes needed if kreasi-ai webhook handler is intact.
- Add a `console.log` for traceability: `[HitPay] Payment confirmed: ${externalId} → ${credits} credits for ${phone}`.
- Ensure `Content-Type: application/json` response with `{ ok: true }` is returned
  to HitPay (some HitPay versions require 200 + body to stop retrying).

---

### 3. `src/components/CreditsModal.tsx`

(Coordinated with M1.2 — already covered there. No additional payment-layer changes
required in the frontend beyond using the new packageIds.)

Confirm the `apiFetch("POST", "/api/payment/create-link", { packageId })` call
uses the new IDs: `"starter"`, `"creator"`, `"unlimited_mo"`.

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `HITPAY_API_KEY` | HitPay API key (already in kreasi-ai env) |
| `HITPAY_SALT` | HMAC salt for webhook verification |
| `HITPAY_ENV` | `"sandbox"` or `"production"` |

---

## TODO: Global Expansion (Stripe)
- Stripe integration deferred. Add a `// TODO: Stripe` comment in the payment route
  for future multi-currency support.
- When adding Stripe, use a separate route `/api/payment/create-stripe-session` so
  HitPay and Stripe can coexist.

---

## Files Touched

| File | Change type |
|------|-------------|
| `server/lib/hitpay.ts` | Edit — update PACKAGES constant |
| `server/routes/webhook.ts` | Edit — confirm + minor logging tweak |
| `src/components/CreditsModal.tsx` | Confirm new packageIds wired correctly |

---

## Acceptance Criteria
- [ ] `POST /api/payment/create-link` with `{ packageId: "starter" }` returns a valid HitPay URL in sandbox.
- [ ] HitPay sandbox payment flow completes and webhook fires.
- [ ] After webhook, user credits increase by the correct amount (5 / 15 / 30).
- [ ] Duplicate webhook does not double-credit.
- [ ] Webhook returns HTTP 200 `{ ok: true }`.
