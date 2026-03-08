# Subscription and Payment Rules

## State Model

Subscription state MUST be derived from the authoritative backend user record. No UI may assume Pro status without a validated source from the server.

### User State Table

| State | Auth | Tier | What User Sees | Allowed Actions |
|-------|------|------|---------------|-----------------|
| Anonymous | No | none | Sign up / Sign in CTA | Browse, limited scans (3 total) |
| Authenticated Free | Yes | free | "Upgrade to Pro" CTA, scan count | Browse, 5 scans/day, upgrade |
| Authenticated Pro (Monthly) | Yes | pro | Pro badge, renewal date | Browse, unlimited scans, manage billing |
| Authenticated Pro (Lifetime) | Yes | pro_lifetime | Pro badge, "Lifetime" label | Browse, unlimited scans, manage billing |
| Expired | Yes | free (downgraded) | "Your Pro expired" + reactivation CTA | Browse, 5 scans/day, reactivate |

### Rules
1. No UI may show "upgrade" if user is already Pro or Lifetime
2. No UI may show scan limits or counts to Pro/Lifetime users (silent 50/day fraud cap)
3. Signed-out users must NOT be sent into payment flows — require sign in first
4. All paywall prompts must map to an explicit state from the table above
5. If auth/membership state is loading or unknown, show a loading indicator — never guess

## App Store Payment Policy (CRITICAL)

### Apple iOS
- Apple requires digital subscriptions purchased inside apps to use In-App Purchase (IAP)
- Routing users to Stripe web checkout for digital subscription features inside an iOS app violates App Store Review Guideline 3.1.1
- **V1 strategy**: Do NOT implement native purchase. Instead:
  - Show membership status if user is already Pro (synced from backend)
  - For free users wanting to upgrade: direct them to the website (orangutany.com/upgrade) in Safari
  - This is a known grey area — document the risk and monitor for rejection
  - Phase 2: implement Apple IAP if app gains traction
- **Safest interim path**: The app shows account status and membership state but does not initiate purchase flows inside the app

### Google Android
- Google Play allows external payment for web-first services with existing subscribers
- Stripe web checkout is generally acceptable for Android
- Same approach as V1 iOS for consistency: direct to website for upgrade

### State Derivation
- On app launch: call `/api/auth/me` to get current user + tier
- On auth change: refresh user state
- Never cache tier locally beyond the current session
- `membershipExpiresAt` drives renewal date display for monthly users
