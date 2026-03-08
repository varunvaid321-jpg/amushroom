# Open Issues

Unresolved decisions and questions. Must be resolved before or during implementation.

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
