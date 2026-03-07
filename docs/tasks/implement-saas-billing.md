# Task: Complete Orangutany SaaS Billing Implementation

**Reference**: `/docs/orangutany-payment-spec.md` (mandatory, do not deviate)

## Context

The core payment architecture is already correct:
- Stripe Checkout Sessions (not payment links) - DONE
- Auth guard before checkout - DONE
- Webhook-based membership activation - DONE
- Membership in DB, not Stripe - DONE

This task completes the missing UI and features.

## Implementation Tasks (in priority order)

### 1. Membership Badge in Header
**File**: `frontend/components/layout/header.tsx`

Show membership status next to user name:
- Free users: show "Free" + "Upgrade" button (current behavior, keep)
- Pro users: show "Pro Member" badge (green)
- Pro Lifetime: show "Pro Lifetime" badge (purple)

Badge must be visible on all pages including mobile.

### 2. Admin Alert for Pro Cap Hit
**File**: `server.js` (scan endpoint)

When a pro user hits 50 scans/day:
- Log warning: `[quota] Pro user ${userId} hit daily cap`
- Send admin email alert via Resend
- Show in admin dashboard under a new "Alerts" section

The 50/day Pro cap is BY DESIGN for fraud prevention. Never remove it.

### 3. Dedicated `/upgrade` Page
**Create**: `frontend/app/upgrade/page.tsx`

Conversion screen showing:
```
Upgrade to Pro

Benefits:
- 50 scans per day (vs 5 for free)
- Full identification details
- Priority features

Pro Monthly        Pro Lifetime
$7.99/month        $49.99 one-time
[Choose]           [Choose]
```

Auth guard: if not logged in, show login modal first.
Both buttons call `startCheckout()` from `useUpgrade` hook.

All existing upgrade triggers (modal, inline buttons) should continue working.
The `/upgrade` page is an additional entry point, not a replacement.

### 4. `/account/billing` Page
**Create**: `frontend/app/account/billing/page.tsx`

Display:
- Current membership type + badge
- Member since date (requires `membership_started_at` column)
- For monthly: "Manage Subscription" button -> Stripe billing portal (route exists at `/api/stripe/portal-session`)
- For monthly: "Upgrade to Lifetime" button
- For free: "Upgrade" button -> `/upgrade`
- For lifetime: "Lifetime Member" confirmation, no actions needed

### 5. Add `membership_started_at` Column
**File**: `src/db.js` (safe migration section)

Add column to users table:
```sql
ALTER TABLE users ADD COLUMN membership_started_at TEXT
```

Set it in webhook handler when membership is activated.

### 6. Monthly -> Lifetime Upgrade
**File**: `server.js` (new endpoint or extend existing)

Flow:
1. User on `/account/billing` clicks "Upgrade to Lifetime"
2. Cancel existing monthly subscription via Stripe API
3. Create new lifetime checkout session
4. Redirect to Stripe
5. Webhook fires -> tier = `pro_lifetime`

## What NOT to Change

- Checkout session flow (already correct)
- Webhook handler (already correct)
- Auth guard (already correct)
- `useUpgrade` hook (already correct)
- File structure (no reorganization needed)
- Pro 50/day scan cap (fraud prevention, by design)
- Stripe price IDs or payment methods

## Guardrails

1. Never start Stripe checkout without authentication
2. Never change membership without webhook confirmation
3. Frontend reads membership from API, never assumes
4. No Stripe payment links - ever
5. Pro 50/day cap stays forever - fraud prevention

## Testing Before Merge

- [ ] Anonymous upgrade -> login required
- [ ] Monthly purchase -> tier = `pro`, badge shows
- [ ] Lifetime purchase -> tier = `pro_lifetime`, badge shows
- [ ] `/upgrade` page renders with both plans
- [ ] `/account/billing` shows correct membership info
- [ ] Monthly user sees "Manage Subscription" + "Upgrade to Lifetime"
- [ ] Pro user hitting 50/day cap triggers admin alert
- [ ] Membership badge visible on all pages
