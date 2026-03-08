# Open Issues

Unresolved decisions and questions. Must be resolved before or during implementation.

**Last updated:** 2026-03-08

## Resolved Since Last Update

### Billing Page Bugs — RESOLVED (PR #97, March 8 2026)
- **Manage Subscription always failed**: `toPublicUser()` didn't include `stripe_customer_id`, so portal handler always returned "No billing account found". Fixed in server.js + src/db.js.
- **Back-button stuck spinner**: bfcache restored frozen React state after Stripe redirect. Fixed with `pageshow` listener in both `use-upgrade.tsx` and `billing/page.tsx`.
- **Silent error on portal/checkout failure**: Errors were caught but no message shown. Now shows visible error text.
- **67 unit tests** added covering financial workflows (PR #98).

## Payment Flow for iOS
- **Issue**: Apple requires In-App Purchase for digital subscriptions sold inside apps (Guideline 3.1.1)
- **Current approach**: V1 directs users to orangutany.com/upgrade in Safari for payment. App shows membership status but does not initiate purchases.
- **Risk**: Apple may reject the app if upgrade CTAs inside the app lead to external payment. Mitigation: frame upgrade as "manage your account on the web" rather than "buy Pro here."
- **Decision needed**: Implement Apple IAP in V1 or defer to V2?
- **Status**: Deferred to V2. V1 will minimize in-app upgrade prompts.

## Android Payment Path
- **Issue**: Should Android use the same "open in browser" approach as iOS, or can we use Stripe directly?
- **Current approach**: Same as iOS for consistency.
- **Decision needed**: Revisit after V1 launch based on Play Store review feedback.
- **Status**: Using same approach as iOS for V1.

## Push Notifications
- **Issue**: Should V1 include push notifications?
- **Decision**: No. Phase 2 feature.
- **Rationale**: Adds complexity (APNs setup, FCM setup, notification handling, permission flow) without clear V1 value.
- **Status**: Deferred to V2.

## Offline Mode
- **Issue**: Should the app work offline?
- **Decision**: No. V1 requires network connectivity.
- **Rationale**: Mushroom identification requires API call. Offline species browsing would require bundling ~100 species pages + images (~500MB+).
- **Status**: Deferred to V2.

## Google OAuth in Capacitor
- **Issue**: Google OAuth currently redirects through the browser. In Capacitor, this needs to open the system browser and return via deep link.
- **Decision needed**: Test current flow in Capacitor WebView. May need Capacitor Browser plugin + deep link callback.
- **Status**: Needs investigation during implementation.

## Account Deletion (BLOCKING)
- **Issue**: In-app account deletion initiation not implemented. Currently email-only (support@orangutany.com).
- **Apple Guideline**: 5.1.1(v) — apps that support account creation must support in-app account deletion.
- **Status**: BLOCKING for App Store submission. See `/docs/specs/account-deletion-spec.md`.

## Privacy Policy Gaps
- **Issue**: Privacy policy page does not mention Stripe, Resend, ip-api.com, or Turso as third-party data processors.
- **Risk**: Privacy declarations in App Store Connect won't match the published privacy policy.
- **Status**: Must update privacy policy before submission.

## Reviewer Test Account
- **Issue**: Must create a test account with known credentials before App Store submission.
- **Status**: Not created. Add credentials to `/docs/release/app-review-notes-draft.md` when ready.

## Free-Limit Copy in Native
- **Issue**: Verify that free-tier limit messages in native mode don't sound like a sales pitch. Wording should state the limit factually without implying the user should buy something.
- **Status**: Needs review pass on all limit-message strings.

## Stripe Portal in Native
- **Issue**: Stripe customer portal is accessible in native for existing subscribers. Verify it doesn't expose upgrade paths.
- **Current state**: Shows "Manage Subscription" for monthly users — acceptable as informational, but needs verification that Stripe portal doesn't show plan upgrade options.
- **Status**: Needs manual verification.
