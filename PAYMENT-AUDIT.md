# Payment Flow Audit Report

**Date**: 2026-03-07
**Auditor**: Claude Code
**Status**: PASS (with 1 fix applied)

---

## Entry Points (all locations where upgrade/payment is triggered)

| # | Location | Component | Trigger | Auth Gate | Both Plans |
|---|----------|-----------|---------|-----------|------------|
| 1 | Header badge (desktop) | `header.tsx:70` | `openUpgrade()` | Via modal | Yes |
| 2 | Hamburger menu "Upgrade to Pro" | `header.tsx:120` | `openUpgrade()` | Via modal | Yes |
| 3 | Quota remaining "Go unlimited" | `upload-panel.tsx:90` | `openUpgrade()` | Via modal | Yes |
| 4 | Free user blocked (daily limit hit) | `upload-panel.tsx:105` | `startCheckout()` direct | Via useUpgrade | Yes |
| 5 | Anonymous blocked (all scans used) | `upload-panel.tsx:95` | `openAuthModal()` + `openUpgrade()` | Direct auth | Yes |
| 6 | Results nudge "Upgrade to Pro" | `results-dock.tsx:251` | `openUpgrade()` | Via modal | Yes |
| 7 | Results soft wall "or Upgrade" | `results-dock.tsx:137` | `openUpgrade()` | Via modal | Yes |

---

## Scenario 1: Unsigned-in User

### Flow: $7.99 Monthly
1. User clicks any upgrade trigger -> Upgrade modal opens
2. Clicks "$7.99/month" -> `startCheckout("monthly")` called
3. `user` is null -> `pendingPlan.current = { plan: "monthly" }` stored
4. Auth modal opens (register tab)
5. User registers or logs in (email/Google)
6. `useEffect` on `user` fires -> detects `pendingPlan.current`
7. `doCheckout("monthly")` called -> redirect message shown: "You're logged in! Taking you to checkout for $7.99/month..."
8. Cancel option available ("Cancel and stay here")
9. `createCheckoutSession("monthly")` -> POST `/api/stripe/create-checkout-session` with `{ plan: "monthly" }`
10. Server: `parseBody()` parses JSON -> `plan = "monthly"` -> `isLifetime = false` -> uses `STRIPE_PRICE_ID`
11. Stripe session created with `mode: "subscription"`, metadata `{ userId, plan: "monthly" }`
12. User redirected to Stripe checkout at $7.99/month
13. **RESULT**: PASS

### Flow: $49.99 Lifetime
1-8. Same as above but with "lifetime"
9. `createCheckoutSession("lifetime")` -> POST with `{ plan: "lifetime" }`
10. Server: `plan = "lifetime"` -> `isLifetime = true` (STRIPE_LIFETIME_PRICE_ID exists) -> uses `STRIPE_LIFETIME_PRICE_ID`
11. Stripe session created with `mode: "payment"`, metadata `{ userId, plan: "lifetime" }`
12. User redirected to Stripe checkout at $49.99 one-time
13. **RESULT**: PASS

---

## Scenario 2: Signed-in Free User

### Flow: $7.99 Monthly
1. User clicks upgrade trigger -> modal opens
2. Clicks "$7.99/month" -> `startCheckout("monthly")`
3. `user` exists -> skips auth gate -> `doCheckout("monthly")` immediately
4. Redirect message shown
5. API call -> Stripe checkout session created with `mode: "subscription"`
6. User at Stripe paying $7.99/month
7. **RESULT**: PASS

### Flow: $49.99 Lifetime
1-3. Same but "lifetime"
4-5. Stripe session with `mode: "payment"`, lifetime price ID
6. User at Stripe paying $49.99
7. **RESULT**: PASS

### Flow: Blocked (daily limit hit)
1. `UpgradeCard` shown directly in upload panel with both plan buttons
2. Both buttons call `startCheckout()` directly (no modal intermediary)
3. User is signed in -> goes straight to Stripe
4. **RESULT**: PASS

---

## Scenario 3: Already Pro User

1. User clicks any upgrade trigger -> modal opens
2. `isPro` check: `user.tier === "pro" || user.tier === "pro_lifetime"`
3. Shows "You're already a Pro member!" with Crown icon
4. "You have unlimited scans. Keep identifying mushrooms to your heart's content."
5. "Got it" button closes modal
6. No payment buttons shown
7. **RESULT**: PASS

---

## Stripe Webhook Processing

| Event | Handler | DB Update |
|-------|---------|-----------|
| `checkout.session.completed` | Reads `metadata.userId` and `metadata.plan` | Sets tier to `pro` or `pro_lifetime`, creates payment record |
| `customer.subscription.deleted` | Finds user by Stripe customer ID | Downgrades to `free` |
| `customer.subscription.updated` | Finds user by Stripe customer ID | Updates status based on subscription state |

### Webhook Correctness
- **Monthly**: `plan = "monthly"`, `session.mode = "subscription"` -> tier = `"pro"`, subscription ID stored
- **Lifetime**: `plan = "lifetime"`, `session.mode = "payment"` -> tier = `"pro_lifetime"`, no subscription ID
- **Double-check**: `isLifetime = plan === 'lifetime' || session.mode === 'payment'` — covers both metadata and mode
- **Payment record**: amount from `session.amount_total`, fallback to 4999/799
- **Email**: Upgrade confirmation email sent via `sendUpgradeEmail()`
- **RESULT**: PASS

---

## Post-Payment Return

- Stripe `success_url`: `https://orangutany.com/?upgraded=1`
- Homepage detects `?upgraded=1` -> shows green banner: "Welcome to Pro! You now have unlimited scans."
- URL cleaned via `replaceState`
- Dismissible with X button
- **RESULT**: PASS

---

## Bug Found & Fixed

### Anonymous "Sign Up Free" Button (upload-panel.tsx:100)
- **Before**: `<a href="/">` — reloads homepage, does nothing useful
- **After**: `<button onClick={() => openAuthModal("register")}>` — opens auth modal
- **Also added**: "or Upgrade to Pro" link below for direct Pro upgrade path
- **File**: `frontend/components/upload/upload-panel.tsx`

---

## Server-Side Safeguards

| Check | Status |
|-------|--------|
| `parseBody()` called before `handleStripeCheckout` | PASS (server.js:1871) |
| Auth required (`getAuthContext`) | PASS (server.js:1277) |
| Same-origin check (`requireSameOrigin`) | PASS (server.js:1869) |
| Plan parameter defaults to "monthly" if missing | PASS (server.js:1280) |
| Stripe customer created if not exists | PASS (server.js:1285-1293) |
| Mode: subscription vs payment based on plan | PASS (server.js:1296) |
| Metadata includes userId + plan | PASS (server.js:1301) |
| Webhook signature verification | PASS (server.js:1350-1351) |

---

## Regression Checklist (review before ANY payment-related change)

- [ ] Both plan buttons ($7.99 and $49.99) visible in upgrade modal
- [ ] Both plans work for: unsigned user, signed-in free user, blocked user
- [ ] `parseBody()` is called before `handleStripeCheckout` in server.js
- [ ] `plan` parameter reaches server as "monthly" or "lifetime" (not undefined)
- [ ] Stripe session mode: "subscription" for monthly, "payment" for lifetime
- [ ] Stripe price IDs: `STRIPE_PRICE_ID` for monthly, `STRIPE_LIFETIME_PRICE_ID` for lifetime
- [ ] Webhook sets tier: "pro" for monthly, "pro_lifetime" for lifetime
- [ ] Already-Pro users see "You're already a Pro member" — no payment buttons
- [ ] Anonymous blocked state: "Sign Up Free" opens auth modal (not `<a href="/">`)
- [ ] Anonymous blocked state: "or Upgrade to Pro" link present
- [ ] Post-payment `?upgraded=1` banner shows on return
- [ ] Auth gate flow: pending plan stored in ref, auto-fires after login
- [ ] Cancel option shown during redirect ("Cancel and stay here")
- [ ] All `openUpgrade()` / `startCheckout()` calls use `useUpgrade()` hook
