# Phase M1.3 — Payment Integration: Summary

**Date:** 2026-05-03

## Changes Made

### 1. `server/lib/hitpay.ts` — PACKAGES constant added
- Added `export const PACKAGES` with M1.2-aligned package definitions:
  - `starter`: 5 credits, IDR 15,000
  - `creator`: 15 credits, IDR 35,000
  - `unlimited_mo`: 30 credits, IDR 75,000
- Removed kreasi-ai-era packages (old inline array with amountIdr/amountSgd fields).
- Added `// TODO: Stripe` comment for future multi-currency route.

### 2. `server/routes/credits.ts` — HitPay create-link endpoint added
- Imported `createPaymentRequest` and `PACKAGES` from `server/lib/hitpay.ts`.
- Replaced old inline PACKAGES array with comment pointing to canonical source.
- Added `POST /api/credits/create-link` endpoint:
  - Accepts `{ packageId }` matching new IDs: "starter", "creator", "unlimited_mo".
  - Calls `createPaymentRequest` (HitPay) and returns `{ url, externalId }`.
  - Registers transaction in DB via `createTransaction`.
  - Carries `// TODO: Stripe` comment for future create-stripe-session route.
- Updated legacy `/purchase` route to use `PACKAGES[packageName]` (object lookup).

### 3. `server/routes/webhook.ts` — Logging + response confirmed
- Added `console.log("[HitPay] Payment confirmed:", externalId, "→", credits, "credits for", phone)` on successful credit grant.
- Changed HitPay webhook success response from `{ received: true }` to `{ ok: true }`.
- HMAC verification, idempotency, and trackPaymentCompleted confirmed intact.

## TypeScript Check
- `npx tsc --noEmit` passed with zero errors.

## Acceptance Criteria Status
- [ ] POST /api/credits/create-link with { packageId: "starter" } returns valid HitPay URL — needs live sandbox test
- [ ] HitPay sandbox payment flow completes and webhook fires — needs live sandbox test
- [ ] After webhook, user credits increase by correct amount (5 / 15 / 30) — needs live sandbox test
- [x] Duplicate webhook does not double-credit — confirmed via existing markPaidAndCredit idempotency
- [x] Webhook returns HTTP 200 { ok: true } — confirmed

## Environment Variables Required
| Variable       | Purpose                              |
|----------------|--------------------------------------|
| HITPAY_API_KEY | HitPay API key                       |
| HITPAY_SALT    | HMAC salt for webhook verification   |
| HITPAY_ENV     | "sandbox" or "production"            |
