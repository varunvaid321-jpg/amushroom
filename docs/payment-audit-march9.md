# Payment System Audit — March 9, 2026

## 1. Complete Payment Journey Map

### Anonymous User → Paying Pro

1. **Anonymous lands on homepage** — can scan 3 times (IP-tracked). After results, sees upgrade nudge: "Enjoying Orangutany? Upgrade to Pro" (`results-dock.tsx:261-269`).

2. **Anonymous exhausts 3 scans** — sees soft wall with blurred results: species name + confidence visible, but edibility/traits/look-alikes blurred behind a lock icon. CTA: "Create Free Account" button + "or Upgrade to Pro" link (`results-dock.tsx:92-143`).

3. **User clicks "Upgrade to Pro" anywhere** — all entry points route through `useUpgrade` hook (`use-upgrade.tsx`). Entry points:
   - Header "Upgrade" badge (free logged-in users)
   - Hamburger menu "Upgrade to Pro"
   - Quota display "Go Pro" link
   - Free user daily limit hit → UpgradeCard
   - Anonymous soft wall "or Upgrade to Pro"
   - Results dock nudge
   - `/upgrade` page directly

4. **If not logged in** — `startCheckout()` stores the plan in `sessionStorage` (`pendingUpgradePlan`) + `pendingPlan` ref, then opens auth modal for registration (`use-upgrade.tsx:69-74`). SessionStorage survives Google OAuth redirect; ref does not.

5. **User registers/logs in** — `useEffect` in `UpgradeProvider` detects `user + pendingPlan.current` and auto-fires `doCheckout()` (`use-upgrade.tsx:102-109`). Also restores from `sessionStorage` on mount for OAuth redirects (`use-upgrade.tsx:41-46`).

6. **`doCheckout()` fires** — shows redirect message ("You're logged in! Taking you to checkout for $49.99 Lifetime..."), calls `POST /api/stripe/create-checkout-session` with `{ plan: "monthly"|"lifetime" }` (`use-upgrade.tsx:51-63`).

7. **Server creates Stripe Checkout Session** (`server.js:1311-1351`):
   - Auth verified via `getAuthContext()` — 401 if not logged in
   - Creates/reuses Stripe customer (stores `stripe_customer_id` in DB)
   - Creates checkout session: `mode: "subscription"` for monthly, `mode: "payment"` for lifetime
   - Metadata includes `userId` and `plan`
   - Success URL: `/?upgraded=1`, Cancel URL: `/`
   - Returns session URL

8. **User redirected to Stripe Checkout** — `window.location.href = url` (`use-upgrade.tsx:57`). Standard Stripe-hosted checkout page.

9. **User pays on Stripe** — after successful payment, redirected back to `orangutany.com/?upgraded=1`.

10. **Homepage shows welcome banner** — "Welcome to Pro! A confirmation email is on its way." with dismiss X button (`frontend/app/(home)/page.tsx:98-104`). URL cleaned via `replaceState`.

11. **Webhook fires** (`server.js:1401-1505`):
    - `checkout.session.completed`: extracts userId from metadata, determines tier
    - For lifetime: cancels any existing monthly subscription
    - For monthly: retrieves subscription to get `current_period_end` for `membership_expires_at`
    - Calls `setUserSubscription()` — sets tier, subscription ID, preserves `membership_started_at` via COALESCE
    - Creates payment record in `payments` table
    - Writes two audit log entries (tier_change + payment)
    - Sends upgrade confirmation email via Resend

12. **User is now Pro** — next `getMe()` call returns updated tier. Badge appears in header. All upgrade prompts disappear. No scan count shown.

### State Changes Summary
```
DB: tier: "free" → "pro" or "pro_lifetime"
DB: stripe_customer_id: NULL → cus_xxx
DB: stripe_subscription_id: NULL → sub_xxx (monthly only)
DB: membership_started_at: NULL → ISO timestamp (set once, never overwritten)
DB: membership_expires_at: NULL → period end (monthly) or NULL (lifetime)
Stripe: Customer created, Checkout Session completed, Subscription active (monthly)
Email: Upgrade confirmation sent
Audit: tier_change + payment events logged
```

---

## 2. Stripe Checkout Experience Issues

### What the Stripe checkout page looks like

The checkout session is created with **minimal customization** (`server.js:1335-1347`):

```js
const sessionParams = {
  mode: isLifetime ? 'payment' : 'subscription',
  customer: customerId,
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${APP_BASE_URL}/?upgraded=1`,
  cancel_url: `${APP_BASE_URL}/`,
  metadata: { userId: String(auth.user.id), plan },
};
```

**What's NOT configured:**
- No `payment_intent_data.description` or `payment_intent_data.statement_descriptor` — credit card statement shows generic Stripe descriptor
- No `custom_text` (Stripe supports custom text on checkout for terms, shipping, etc.)
- No `consent_collection` for terms of service
- No `phone_number_collection`
- No `allow_promotion_codes` — cannot offer discount codes
- No `billing_address_collection` — Stripe defaults to "auto"
- No product name/description visible unless set on the Stripe Price object in the dashboard

**What the user experiences:**
- Redirected to `checkout.stripe.com` — fully leaves orangutany.com
- Sees whatever product name/description is set on the Stripe Price object (configured in Stripe Dashboard, not in code)
- Stripe branding settings (logo, colors, brand name) are configured at the account level in Stripe Dashboard — not via API in this codebase
- If Stripe Dashboard branding is not customized, it looks like a generic white checkout page

**What CAN be customized via Stripe API:**
- `custom_text.submit.message` — message above the pay button
- `custom_text.after_submit.message` — shown after checkout
- `consent_collection.terms_of_service` — require TOS acceptance
- `allow_promotion_codes: true` — enable promo codes
- `payment_method_types` — restrict to specific methods
- `locale` — force language
- `submit_type` — "pay", "book", "donate", or "auto"
- Account-level: logo, icon, brand color, accent color (Stripe Dashboard > Settings > Branding)

### Key Issue
The checkout has **no statement descriptor customization**. Users see a generic charge on their credit card statement. Should set `payment_intent_data.statement_descriptor` to "ORANGUTANY PRO" or similar (max 22 chars).

---

## 3. Self-Service Capabilities Audit

| Action | Can do without stripe.com? | How | Notes |
|--------|---------------------------|-----|-------|
| Sign up for monthly Pro | YES | `/upgrade` page → Stripe Checkout → webhook activates | Full flow in-app |
| Sign up for lifetime Pro | YES | `/upgrade` page → Stripe Checkout → webhook activates | Full flow in-app |
| Switch from monthly to lifetime | YES | `/account/billing` → "Switch to Lifetime ($49.99 one-time)" → new checkout session | Old sub auto-cancelled by webhook (`server.js:1428-1438`) |
| Cancel monthly subscription | YES | `/account/billing` → "Cancel Subscription" → in-app confirmation → `POST /api/stripe/cancel-subscription` | Instant, no Stripe portal. Downgrades immediately (`server.js:1366-1384`) |
| Resume a cancelled subscription | NO | No re-subscribe button exists on billing page after cancellation. User must navigate to `/upgrade` manually. Billing page shows "Upgrade to Pro" link but only if `!cancelSuccess` (`billing/page.tsx:172`). After refresh, link appears. | Minor gap — after cancel success message, no immediate re-subscribe CTA |
| Update payment method / card | PARTIAL | Monthly users have NO portal access. Only lifetime users see "View Receipts" (Stripe portal). Monthly users cannot update their card without going to Stripe directly. | **Significant gap** — monthly users with expiring cards have no way to update payment method |
| View billing history / past invoices | PARTIAL | Only lifetime users with `hasStripeCustomer` see "View Receipts" button → Stripe portal (`billing/page.tsx:235-243`). Monthly users have NO access to invoices or receipts. | **Gap** — monthly users paying recurring $7.99 cannot see any receipts |
| Request a refund | NO | No refund mechanism exists anywhere. No refund policy page. Users must email support (but no support email is displayed on billing page). | **Gap** |
| Downgrade from Pro to free | YES (monthly) / NO (lifetime) | Monthly: cancel subscription. Lifetime: no downgrade path (makes sense — it's permanent). | Working as designed |
| View current plan status | YES | `/account/billing` shows tier, price, renewal date, member since date | Well implemented |

### Critical Gaps:
1. **Monthly users cannot update payment method** — no portal access, no card update API. If their card expires, payment fails silently.
2. **Monthly users cannot view receipts** — portal button only shown to lifetime users (`billing/page.tsx:235`). The condition `isLifetime && user.hasStripeCustomer` explicitly excludes monthly users.
3. **No support contact** on billing page — if something goes wrong, user has no way to reach out.

---

## 4. Edge Cases & Failure Modes

### Webhook fails/is delayed
- **Handled**: Webhook returns 500 on application errors (`server.js:1497-1500`), triggering Stripe retry (up to 3 days, exponential backoff).
- **Risk**: User sees `?upgraded=1` banner on homepage but their tier hasn't changed yet. The banner is triggered by URL param, not by actual tier verification. User may see "Welcome to Pro!" while still being free.
- **Mitigation gap**: No client-side polling or verification that tier actually changed after redirect.

### User pays but webhook never fires
- **Risk**: User charged but stays on free tier. No automated recovery.
- **Detection**: Admin can check Stripe Dashboard for completed payments without matching DB records.
- **Missing**: No reconciliation job, no admin tool to manually upgrade a user, no webhook failure alerting.

### User cancels mid-billing cycle
- **Behavior**: `handleCancelSubscription` calls `stripe.subscriptions.cancel()` which cancels immediately (not at period end) (`server.js:1374`). Then `downgradeUser()` sets tier to "free" immediately.
- **Issue**: User loses Pro access immediately, even if they paid for a full month. The cancellation message confirms this: "You'll lose Pro benefits immediately" (`billing/page.tsx:203`).
- **Alternative not offered**: `cancel_at_period_end` would let users keep access until their paid period expires. Current behavior is more aggressive than industry standard.

### Card expires
- **Monthly users cannot update their card** (see Section 3). Stripe will retry failed payments per its Smart Retries, but if ultimately unsuccessful:
  - Stripe fires `customer.subscription.updated` with status != "active"
  - Webhook calls `downgradeUser()` → user loses access
  - No email notification to user about failing payment (only Stripe's default dunning emails, if enabled in Dashboard)

### Payment fails on renewal
- **Handled partially**: `invoice.payment_succeeded` webhook creates payment record. `customer.subscription.updated` with non-active status triggers downgrade.
- **Missing**: No `invoice.payment_failed` handler. Stripe will retry, but there's no app-level notification to the user.

### Double-click on checkout button
- **Handled**: `checkoutLoading` state disables both plan buttons while checkout is in progress (`upgrade/page.tsx:85,99`). Good.
- **Minor risk**: If the API call is very fast and the redirect is slow, user could potentially click again. Low probability.

### Browser back button during checkout
- **Handled**: `pageshow` event listener resets `checkoutLoading` and `redirectMessage` when page is restored from bfcache (`use-upgrade.tsx:90-99`, `billing/page.tsx:21-29`). Good.

### OAuth redirect losing pending upgrade state
- **Handled**: `sessionStorage.setItem("pendingUpgradePlan", plan)` persists across the Google OAuth redirect. On mount, `useEffect` restores from sessionStorage (`use-upgrade.tsx:41-46`). After login, `useEffect` detects `user + pendingPlan.current` and auto-fires checkout (`use-upgrade.tsx:102-109`). Good.
- **Edge case**: If user closes browser during OAuth flow and comes back later, sessionStorage is lost. Acceptable.

### User is logged out when webhook fires
- **Not an issue**: Webhook uses `userId` from Stripe session metadata, not from request cookies. Webhook operates server-side only, independent of user session state (`server.js:1421`). Good.

### Race condition: checkout.session.completed + customer.subscription.updated arriving simultaneously
- **Potential issue**: Both handlers modify user tier. `checkout.session.completed` sets tier to "pro", then `customer.subscription.updated` with `status: "active"` also calls `setUserSubscription`. The second call is idempotent (same tier), so no harm. Good.

---

## 5. UX Friction Points

### 5a. Immediate cancellation is harsh
- Cancellation is **instant** — user loses Pro access the moment they cancel, even mid-billing cycle (`server.js:1374-1375`). Industry standard is to cancel at period end. The confirmation message says "You'll lose Pro benefits immediately" which is honest but feels punitive. Users who want to cancel but keep access until their paid period ends cannot do so.

### 5b. No receipt/invoice access for monthly users
- Only lifetime users see "View Receipts" button. Monthly users paying $7.99/month have no way to access receipts or invoices from within the app. This is especially problematic for users who need receipts for expense reporting or tax purposes.

### 5c. No payment method management for monthly users
- If a monthly user needs to update their credit card (expiring card, lost card, new card), there is no UI to do so. The Stripe portal button is gated behind `isLifetime` (`billing/page.tsx:235`). Monthly users would need to cancel and re-subscribe, losing their original signup date context.

### 5d. Cancel success → no clear re-subscribe path
- After cancelling, the success message says "You can upgrade again anytime" but the "Upgrade to Pro" button is hidden behind `!cancelSuccess` condition (`billing/page.tsx:172`). User must refresh the page to see the upgrade link. Minor but feels broken.

### 5e. No confirmation page after Stripe checkout
- After payment, user lands on homepage with a small green banner. There's no dedicated "Thank you" / confirmation page showing what they purchased, when it renews, receipt link, etc. The banner is dismissible and easy to miss.

### 5f. Redirect message during checkout could be confusing
- `redirectMessage` shows "You're logged in! Taking you to checkout for $49.99 Lifetime..." but this appears on whatever page the user was on (could be homepage, results, anywhere). It's a context-provided message, not a dedicated loading screen. If the redirect is slow, user may not understand what's happening.

### 5g. No loading state differentiation on /upgrade page
- Both plan buttons share the same `checkoutLoading` state. When user clicks "Lifetime", both buttons disable. User can't tell which plan is being processed. Should show a spinner on the clicked button only.

### 5h. Cancel URL sends user to homepage, not back to upgrade page
- `cancel_url: \`${APP_BASE_URL}/\`` (`server.js:1340`) — if user abandons Stripe checkout, they land on the homepage, not back on `/upgrade` where they started. They lose context of their upgrade intent.

---

## 6. Missing Features That Affect Confidence

### 6a. No refund policy page
- No `/refund-policy`, `/terms`, or any page explaining what happens if a user wants a refund. No refund mechanism in code. Users have no idea if refunds are possible before purchasing.

### 6b. No invoice/receipt access for monthly users
- As detailed in 5b. Monthly subscribers have no financial records accessible from the app.

### 6c. No subscription management without workarounds
- Monthly users cannot: update card, pause subscription, change billing email, or download invoices. Only cancellation is available in-app.

### 6d. No trust signals on upgrade page
- `/upgrade` page has a tiny footer: "Secure payment via Stripe. Cancel monthly anytime. Lifetime is forever." (`upgrade/page.tsx:124`). No:
  - Money-back guarantee mention
  - Security badges / SSL lock icons
  - Number of users / social proof
  - Testimonials or reviews
  - Stripe logo/badge
  - Refund policy link

### 6e. No failed payment notification system
- No `invoice.payment_failed` webhook handler. No in-app notification when a payment fails. Relies entirely on Stripe's default dunning emails (if configured in Dashboard).

### 6f. No way to contact support from billing page
- Billing page has no support email, no help link, no chat widget. If a user has a billing issue, they have no path to resolution from the billing page itself.

### 6g. No email notification on cancellation
- When a user cancels, no confirmation email is sent. Only a green banner on the billing page. If they accidentally cancel, there's no email record.

### 6h. No pro-rated refund or credit on monthly → lifetime upgrade
- When a monthly user upgrades to lifetime ($49.99), their existing monthly subscription is cancelled immediately. No pro-rated credit for unused days of the current billing period is applied to the lifetime purchase.

---

## 7. Recommendations (Prioritized)

### Critical (blocks revenue or causes payment issues)

1. **Give monthly users portal access for card updates** — Change `billing/page.tsx:235` from `isLifetime && user.hasStripeCustomer` to `isPro && user.hasStripeCustomer` or add a separate "Manage Payment Method" button for monthly users. Without this, expiring cards = lost subscribers with no self-service recovery.
   - Files: `frontend/app/account/billing/page.tsx:235`

2. **Add `invoice.payment_failed` webhook handler** — Log the failure, notify the user in-app or via email that their payment failed and card needs updating. Without this, users silently lose Pro access.
   - File: `server.js` (webhook handler around line 1482)

3. **Cancel at period end instead of immediately** — Use `stripe.subscriptions.update(subId, { cancel_at_period_end: true })` instead of `stripe.subscriptions.cancel()`. User keeps access until the end of their paid period. Update billing UI to show "Cancels on [date]" and offer "Resume subscription" button.
   - Files: `server.js:1374`, `frontend/app/account/billing/page.tsx:200-227`

### Important (affects trust and conversion)

4. **Give monthly users receipt/invoice access** — Either show the Stripe portal button for all Pro users (not just lifetime), or build an in-app invoice list using `stripe.invoices.list({ customer })`.
   - File: `frontend/app/account/billing/page.tsx:235`

5. **Add statement descriptor** — Set `payment_intent_data.statement_descriptor` to "ORANGUTANY" in checkout session creation so users recognize the charge on their credit card.
   - File: `server.js:1335`

6. **Create a post-purchase confirmation page** — Instead of `success_url: /?upgraded=1`, create `/upgrade/success` that shows: plan purchased, renewal date (if monthly), receipt link, "Start identifying" CTA. Feels more premium.
   - Files: new `frontend/app/upgrade/success/page.tsx`, `server.js:1339`

7. **Add refund policy** — Create `/refund-policy` page (even if policy is "contact us for refunds within 7 days"). Link from upgrade page footer and billing page.
   - File: new `frontend/app/refund-policy/page.tsx`

8. **Add support contact to billing page** — Even a simple "Questions? Email support@orangutany.com" at the bottom.
   - File: `frontend/app/account/billing/page.tsx:247`

9. **Fix cancel success → re-subscribe gap** — Remove `!cancelSuccess` condition from upgrade button, or add explicit "Re-subscribe" CTA in the cancel success message.
   - File: `frontend/app/account/billing/page.tsx:172`

10. **Send cancellation confirmation email** — When user cancels, send email confirming cancellation with date, what they lose, and how to re-subscribe.
    - Files: `src/email.js`, `server.js:1376`

### Nice-to-Have

11. **Set cancel_url to `/upgrade`** instead of `/` so users who abandon checkout return to the upgrade page, not the homepage.
    - File: `server.js:1340`

12. **Enable promo codes** — Add `allow_promotion_codes: true` to checkout session for future marketing campaigns.
    - File: `server.js:1335`

13. **Add Stripe branding** — Configure logo, brand color, accent color in Stripe Dashboard (Settings > Branding) so checkout feels like part of Orangutany.
    - Action: Stripe Dashboard configuration (not code)

14. **Add trust signals to upgrade page** — Stripe badge, "Cancel anytime" more prominently, money-back guarantee if offering one.
    - File: `frontend/app/upgrade/page.tsx:123`

15. **Per-button loading spinner** — Track which plan button was clicked and show spinner only on that button.
    - Files: `frontend/app/upgrade/page.tsx`, `frontend/hooks/use-upgrade.tsx`

16. **Webhook failure alerting** — Add admin notification (email or in-app) when webhook processing fails, so payment/tier mismatches can be caught quickly.
    - File: `server.js:1497`

17. **Reconciliation job** — Periodic check comparing Stripe active subscriptions against DB tier values to catch any webhook misses.
    - File: new script or cron job

18. **Pro-rate monthly → lifetime upgrade** — Use Stripe's proration or credit functionality when a monthly user upgrades to lifetime mid-cycle.
    - File: `server.js:1428-1438`

---

---

## 8. Admin Page: Country Flags Bug

### Issue
The `countryFlag()` function in both `/admin/page.tsx` (line 64-69) and `/admin/scans/page.tsx` (line 22-27) takes the first 2 characters of the **country name** and converts to a flag emoji. But ip-api.com returns full country names ("United States", "Canada", "Germany"), not ISO codes.

- "United States" → "UN" → wrong flag
- "Canada" → "CA" → correct (by luck)
- "Germany" → "GE" → Georgia flag instead of Germany

### Fix needed
Either:
1. Change ip-api.com request to include `countryCode` field and store that instead/alongside country name
2. Or add a country-name-to-ISO-code mapping in the `countryFlag()` function
3. Or use ip-api.com's `fields=status,countryCode,country,city` and store the code separately

### Files
- `server.js:192` — ip-api.com request (add `countryCode` to fields)
- `src/db.js:91-101` — analytics_events schema (may need `country_code` column)
- `frontend/app/admin/page.tsx:64-69` — `countryFlag()` function
- `frontend/app/admin/scans/page.tsx:22-27` — same function duplicated

---

## File Reference

| File | Role |
|------|------|
| `/Users/varunvaid/amushroom/server.js:1311-1505` | All Stripe routes + webhook handler |
| `/Users/varunvaid/amushroom/frontend/app/upgrade/page.tsx` | Upgrade page UI (plan selection) |
| `/Users/varunvaid/amushroom/frontend/app/account/billing/page.tsx` | Billing dashboard (plan status, cancel, portal) |
| `/Users/varunvaid/amushroom/frontend/hooks/use-upgrade.tsx` | Upgrade flow state management + auth gate |
| `/Users/varunvaid/amushroom/frontend/components/results/results-dock.tsx` | Upgrade nudges in scan results |
| `/Users/varunvaid/amushroom/frontend/lib/api.ts` | API client (checkout, portal, cancel functions) |
| `/Users/varunvaid/amushroom/src/db.js:880-916` | DB functions for Stripe customer/subscription/payment management |
| `/Users/varunvaid/amushroom/src/email.js:144+` | Upgrade confirmation email |
| `/Users/varunvaid/amushroom/docs/orangutany-payment-spec.md` | Payment spec v2.0 |
