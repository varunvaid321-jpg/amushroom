# Orangutany Payment & Membership System Specification

**Version**: 2.0 (Updated March 7 2026)
**Status**: Mandatory Reference Document

All payment-related code must follow this document.

## Current State (All Implemented)

- Stripe Checkout Sessions (NOT payment links) -- zero payment links in codebase
- Auth guard before checkout (`getAuthContext()`)
- User ID in Stripe session metadata
- Webhook-based membership activation (returns 500 on errors so Stripe retries)
- Monthly subscription auto-cancelled on lifetime upgrade (PR #80)
- Pending upgrade plan persisted in sessionStorage (survives Google OAuth redirect)
- Immutable audit log (signup, login, tier change, payment events)
- Membership badge in header (green = Pro, purple = Lifetime)
- Dedicated `/upgrade` page with benefits + plan cards
- `/account/billing` dashboard (membership info, Stripe portal, upgrade path)
- Admin alert when pro user hits daily cap
- Logout refreshes to homepage (clears stale state)

## 1. Core Principle

A user must be authenticated before any payment begins.

```
anonymous -> login/signup -> stripe checkout session -> webhook -> membership activated
```

Stripe only processes payments. Orangutany database stores membership state.

## 2. Membership Types

| Tier | DB Value | Price | Stripe Mode |
|------|----------|-------|-------------|
| Free | `free` | $0 | none |
| Pro Monthly | `pro` | $7.99/mo | subscription |
| Pro Lifetime | `pro_lifetime` | $49.99 | one-time payment |

Database columns:
- `users.tier` -- membership state
- `stripe_customer_id` -- Stripe customer
- `stripe_subscription_id` -- active subscription (NULL for lifetime)
- `membership_started_at` -- set on first upgrade, never overwritten (COALESCE)

## 3. Scan Limits (INTERNAL -- NEVER SHOW TO USERS)

| Tier | Daily Limit | Rationale |
|------|-------------|-----------|
| Anonymous | 3 total (by IP) | Conversion funnel |
| Free | 5/day | Conversion funnel |
| Pro / Pro Lifetime | 50/day | Fraud prevention |

**CRITICAL RULES:**
- The 50/day Pro cap is silent fraud protection. Users must NEVER see this number.
- No UI text may reference "50 scans", "unlimited scans", or any Pro scan count.
- When a Pro user hits 50/day, the analyze button silently disables until next day. No error message, no explanation.
- Free/anonymous users see their remaining count (e.g. "3 of 5 daily scans remaining") but Pro users see nothing.
- Admin alert fires when any Pro account hits the cap.

## 4. Authentication Requirement

All upgrade attempts verify authentication first.

Server: `getAuthContext()` returns 401 if not authenticated.

Frontend: `useUpgrade` hook flow:
1. User clicks upgrade
2. If not logged in: store plan in `sessionStorage` + open auth modal
3. After login: `useEffect` detects user + pending plan -> auto-triggers `doCheckout`
4. Google OAuth: sessionStorage survives the redirect, ref would not

## 5. Upgrade Entry Points

All route through `useUpgrade` hook:
- Header "Upgrade" badge (for free logged-in users)
- Hamburger menu "Upgrade to Pro"
- Quota remaining display "Go Pro" link
- Free user daily limit hit -> UpgradeCard with plan buttons
- Anonymous all scans used -> sign up prompt + "or Upgrade to Pro"
- Results dock nudge "Enjoying Orangutany? Upgrade to Pro"

## 6. Stripe Checkout Flow

```
POST /api/stripe/create-checkout-session
  -> verify auth (getAuthContext, 401 if not)
  -> create/find Stripe customer (reuse if exists)
  -> create checkout session with userId + plan in metadata
  -> return session URL
  -> frontend redirects to Stripe
  -> after payment: redirect to /?upgraded=1
```

## 7. Webhook

Endpoint: `POST /api/stripe/webhook`

Signature verified via `stripe.webhooks.constructEvent`.

Events:
- `checkout.session.completed` -> activate membership, create payment record, write audit log, send upgrade email. If lifetime: cancel existing monthly subscription first.
- `invoice.payment_succeeded` -> create payment record, write audit log
- `customer.subscription.deleted` / `customer.subscription.updated` -> downgrade to free if status not active/trialing

**Error handling**: Returns 500 on application errors so Stripe retries (up to 3 days).

## 8. UI Rules

### Pro users see:
- Membership badge in header (green "Pro" or purple "Lifetime") linking to /account/billing
- No scan count, no quota display, no upgrade prompts

### Free users see:
- "X of 5 daily scans remaining" with "Go Pro" link
- When blocked: UpgradeCard with plan buttons
- Upgrade nudge after results

### Anonymous users see:
- "X of 3 free scans remaining" with "Go Pro" link
- When blocked: sign up prompt + upgrade option
- Soft wall on results (locked edibility info)

### After upgrade:
- Welcome banner: "Welcome to Pro! A confirmation email is on its way."
- All upgrade prompts disappear
- Membership badge appears in header

## 9. Monthly to Lifetime Upgrade

Flow:
1. Billing page shows "Upgrade to Lifetime ($49.99)" for monthly users
2. Calls `startCheckout("lifetime")` -> creates new checkout session
3. Webhook receives `checkout.session.completed` with plan=lifetime
4. Server cancels existing monthly subscription via `stripe.subscriptions.cancel()`
5. Sets tier to `pro_lifetime`, subscription_id to NULL

## 10. Billing Dashboard (`/account/billing`)

Shows:
- Membership type and badge
- Member since date
- Plan price
- Monthly users: "Manage Subscription" (Stripe portal) + "Upgrade to Lifetime"
- Lifetime users: "View Receipts" (Stripe portal)
- Free users: "Upgrade to Pro" link

Portal return URL: `/account/billing`

## 11. Audit Log

Table: `audit_log` (immutable, 3-year minimum retention)
- INSERT-only. No DELETE or UPDATE functions exist.
- Events: `signup`, `login`, `tier_change`, `payment`
- Fields: event_type, user_id, user_email, details (JSON), ip, created_at

## 12. Guardrails

1. Never start Stripe checkout without authentication
2. Never change membership without webhook confirmation
3. Frontend reads membership from API (never assumes)
4. All upgrade buttons route through `useUpgrade` hook
5. No Stripe payment links -- ever
6. Pro scan cap is silent -- never show the number to users
7. Webhook returns 500 on errors (Stripe retries)
8. Monthly sub cancelled before lifetime activation
9. Pending plan survives OAuth redirect via sessionStorage
10. Audit log is immutable -- no delete path exists

## 13. Testing Checklist

- [ ] Anonymous upgrade attempt -> login required
- [ ] Monthly payment -> tier = `pro`
- [ ] Lifetime purchase -> tier = `pro_lifetime`
- [ ] Monthly -> lifetime -> old subscription cancelled, tier changed
- [ ] Free user -> blocked after 5 scans
- [ ] Pro user -> silently blocked after daily cap, no message shown
- [ ] Membership badge visible in header for Pro/Lifetime
- [ ] No "50 scans" or "unlimited" text anywhere in UI
- [ ] Admin alert when pro user hits daily cap
- [ ] Google OAuth -> upgrade intent preserved across redirect
