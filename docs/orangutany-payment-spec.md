# Orangutany Payment & Membership System Specification

**Version**: 1.0
**Status**: Mandatory Reference Document

All payment-related code must follow this document.

## Current State (Audited March 7 2026)

The system ALREADY correctly implements:
- Stripe Checkout Sessions (NOT payment links)
- Auth guard before checkout (`getAuthContext()` on checkout route)
- User ID passed in Stripe session metadata
- Webhook-based membership activation
- Billing portal route (`/api/stripe/portal-session`)

**There are zero Stripe payment links in the codebase.**

## 1. Core Principle

A user must be authenticated before any payment begins.

Correct workflow:
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

Database column: `users.tier`

Additional columns:
- `stripe_customer_id`
- `stripe_subscription_id`
- `membership_started_at` (TODO: add)
- `membership_expires_at` (TODO: add)

## 3. Scan Limits (BY DESIGN - DO NOT CHANGE)

| Tier | Daily Limit | Rationale |
|------|-------------|-----------|
| Anonymous | 3 total (by IP) | Conversion funnel |
| Free | 5/day | Conversion funnel |
| Pro / Pro Lifetime | **50/day** | **Fraud prevention** |

The 50/day Pro cap is intentional. It prevents a single compromised account from depleting all Kindwise API credits. This cap is linked to abuse detection in the admin dashboard. An admin alert should fire when any account hits this cap.

**NEVER change Pro to "unlimited".**

## 4. Authentication Requirement

All upgrade attempts must verify authentication first.

Implementation: `getAuthContext()` in server.js (already correct)

Frontend: `useUpgrade` hook stores pending plan in ref, opens auth modal, auto-triggers checkout after login (already correct)

## 5. Upgrade Entry Points

Upgrade buttons exist in:
- Header badge (desktop)
- Hamburger menu
- Quota remaining display
- Free user blocked (daily limit hit)
- Anonymous blocked (all scans used)
- Results nudge
- Results soft wall

All route through `useUpgrade` hook -> `openUpgrade()` or `startCheckout()`.

## 6. Stripe Checkout Flow (Already Implemented)

```
POST /api/stripe/create-checkout-session
  -> verify auth (getAuthContext)
  -> create/find Stripe customer
  -> create checkout session with user_id in metadata
  -> return session URL
  -> redirect to Stripe
```

## 7. Webhook (Already Implemented)

Endpoint: `POST /api/stripe/webhook`

Events handled:
- `checkout.session.completed` -> activate membership
- `invoice.payment_succeeded` -> record payment
- `customer.subscription.deleted` -> downgrade to free

## 8. What's Missing (Implementation TODO)

### 8.1 Dedicated `/upgrade` page
Conversion screen with benefits + plan cards before Stripe redirect.
Currently only a modal.

### 8.2 `/account/billing` page
- View membership type
- View billing history
- Cancel monthly plan (via Stripe billing portal - route exists, UI missing)
- Upgrade monthly -> lifetime

### 8.3 Membership badge in header
Show visible badge: Pro Member / Pro Lifetime / Free User
Currently just hides the upgrade button for pro users.

### 8.4 Monthly -> Lifetime upgrade path
Cancel existing subscription + create lifetime checkout.
No UI for this currently.

### 8.5 `membership_started_at` column
Add to users table, set on webhook activation.

### 8.6 Admin alert for Pro cap hit
When any account reaches 50 scans/day, trigger alert in admin dashboard.

## 9. Guardrails

1. Never start Stripe checkout without authentication
2. Never change membership without webhook confirmation
3. Frontend must always read membership from API (never assume)
4. Payment success page must verify membership before rendering
5. All upgrade buttons route through `useUpgrade` hook
6. No Stripe payment links - ever
7. Pro 50/day cap is fraud prevention - never remove

## 10. Testing Checklist

- [ ] Anonymous upgrade attempt -> login required
- [ ] Monthly payment -> tier = `pro`
- [ ] Lifetime purchase -> tier = `pro_lifetime`
- [ ] Monthly -> lifetime upgrade -> subscription cancelled, tier changed
- [ ] Free user -> blocked after 5 scans
- [ ] Pro user -> allowed up to 50/day, blocked after
- [ ] Membership badge visible in header
- [ ] Admin alert when pro user hits 50/day cap
