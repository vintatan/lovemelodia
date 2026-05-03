# Phase M1.2 — Auth & Credit Model Update

## Goal
Update the inherited kreasi-ai credit model to match Lovemelodia's gifting context.
New users receive 3 free credits. Each credit funds one complete gift card generation
(music + card). All credit-facing copy is updated to gift-centric language.

---

## Changes

### 1. `server/routes/auth.ts`

**Pattern reference:** `getOrCreateUserAsync` in `server/lib/db.ts` inserts a user
with 0 credits, then the auth route grants an initial allotment via `addCreditsAsync`.

**What to change:**
- In the `verify-otp` handler, after `getOrCreateUserAsync`, detect new users
  (credits === 0 AND no prior transactions) and call `addCreditsAsync(phone, 3, "topup_approved")`.
- The check for "new user" should be: `user.credits === 0` plus a guard that no
  transaction row exists for this phone — prevents double-granting on re-login.
- Update OTP message brand copy: replace "Kreasi AI" with "Lovemelodia".

```ts
// Pseudocode — new-user credit grant
const isNewUser = user.credits === 0 && !hasAnyTransaction(normalized);
if (isNewUser) {
  await addCreditsAsync(normalized, 3, "topup_approved");
  user.credits = 3;
}
```

---

### 2. `src/components/CreditsBadge.tsx`

**What to change:**
- Replace display string `"X kredit"` with `"X hadiah tersisa"`.
- When credits === 1, use `"1 hadiah tersisa"` (no pluralisation issue in BI, but be consistent).
- When credits === 0, render badge in red/warning state with text `"Habis"`.
- Low-credit warning threshold: show amber color when credits < 3 (was < 10 in kreasi-ai
  for the WhatsApp Jagat flow — not applicable here).

---

### 3. `src/components/CreditsModal.tsx`

Replace the existing kreasi-ai packages with Lovemelodia gift packages:

| Package       | Credits | Price    | ID             |
|---------------|---------|----------|----------------|
| Starter       | 5       | Rp15.000 | `starter`      |
| Creator       | 15      | Rp35.000 | `creator`      |
| Unlimited     | 30/mo   | Rp75.000 | `unlimited_mo` |

- Starter tile: label "Starter", subtitle "5 gift card", price "Rp15rb"
- Creator tile: label "Creator", subtitle "15 gift card · paling hemat", price "Rp35rb",
  add a "POPULER" badge
- Unlimited tile: label "Unlimited", subtitle "30 gift/bulan", price "Rp75rb/bulan",
  add a "TERBAIK" badge
- Remove any WhatsApp group join CTA that existed in kreasi-ai's modal.
- Keep HitPay payment trigger pattern identical — just update package names/amounts passed
  to `POST /api/payment/create-link`.

---

### 4. `src/components/NewMemberModal.tsx`

The kreasi-ai `NewMemberModal` prompts new users to join a WhatsApp group in exchange
for bonus credits. That mechanic does not exist in Lovemelodia.

**Replace entirely with a simple welcome state:**
- Trigger: shown once on first login (same `localStorage` flag pattern as kreasi-ai).
- Content:
  - Headline: "Selamat datang di Lovemelodia 🎁"
  - Body: "Kamu punya **3 hadiah gratis** untuk mulai. Pilih momen, buat lagunya, dan kirim
    ke orang tersayang."
  - Single CTA button: "Mulai Bikin Lagu" → closes modal.
- No WhatsApp link, no promo code input, no countdown timer.
- Keep the same Framer Motion fade-in/scale animation pattern.

---

## Files Touched

| File | Change type |
|------|-------------|
| `server/routes/auth.ts` | Edit — new-user grant 3 credits, update brand copy |
| `src/components/CreditsBadge.tsx` | Edit — copy + color thresholds |
| `src/components/CreditsModal.tsx` | Edit — replace package list + prices |
| `src/components/NewMemberModal.tsx` | Rewrite — remove promo/WA flow, add welcome message |

---

## Dependencies
- None beyond what kreasi-ai already uses.
- `hasAnyTransaction` helper: add to `server/lib/db.ts` as a prepared statement
  `SELECT 1 FROM transactions WHERE phone = ? LIMIT 1`.

---

## Acceptance Criteria
- [ ] New user signup receives exactly 3 credits.
- [ ] Re-login on existing 0-credit account does NOT re-grant 3 credits.
- [ ] CreditsBadge shows "3 hadiah tersisa" on first login.
- [ ] CreditsBadge turns amber at 2 credits, red/Habis at 0.
- [ ] CreditsModal shows three new packages with correct prices.
- [ ] NewMemberModal shows welcome message with no WhatsApp link.
- [ ] Closing NewMemberModal does not reopen on same session (localStorage flag).
