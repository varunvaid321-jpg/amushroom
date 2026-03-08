# Mobile App Implementation Spec

## Goals
1. Ship Orangutany to iOS App Store and Google Play Store
2. Provide native camera/photo integration for mushroom identification
3. Maintain feature parity with web app
4. Pass app store review on first submission

## Non-Goals (V1)
- Push notifications
- Offline mode / offline species database
- In-app purchase (IAP)
- Social features
- Native navigation (web navigation is sufficient)

## Architecture

### Stack
- **Shell**: Capacitor 6.x
- **Web layer**: Existing Next.js app (production build served from native shell)
- **Native plugins**: @capacitor/camera, @capacitor/filesystem (if needed)
- **Platforms**: iOS 16+, Android API 24+ (Android 7+)

### App Shell Behavior
1. App launches with native splash screen
2. Capacitor WebView loads the Next.js production build
3. Navigation happens inside the WebView (no browser chrome visible)
4. Status bar matches app theme (dark background)
5. Safe areas/notches handled via CSS `env(safe-area-inset-*)`
6. Hardware back button (Android) navigates WebView history

### Auth Behavior
- Session cookies work inside Capacitor WebView
- On launch, app calls `/api/auth/me` to check auth state
- Auth state drives header UI (same as web)
- Google OAuth opens in system browser via Capacitor plugin, returns via deep link

### Membership Behavior
- Tier derived from `/api/auth/me` response
- Pro badge shown in header for pro/pro_lifetime users
- Upgrade prompts suppressed for pro users
- Free users directed to orangutany.com/upgrade in system browser (not in-app webview)
- See `/rules/subscription-rules.md` for full state table

### Image/Camera Flow
1. User taps "upload" area on identify page
2. Capacitor Camera plugin presents native action sheet: "Take Photo" / "Choose from Gallery"
3. Selected image returned as base64 or file URI
4. Image injected into existing upload flow
5. Existing analyze/identify pipeline handles the rest

### Deep Linking
- `orangutany.com/mushrooms/*` opens species pages
- `orangutany.com/articles/*` opens articles
- Universal Links (iOS) + App Links (Android)

### Build/Release Flow
1. `npm run build` — Next.js production build
2. `npx cap sync` — copy web assets to native projects
3. Open in Xcode / Android Studio
4. Build, sign, archive
5. Submit to App Store Connect / Google Play Console

## QA Requirements
- All states from `/docs/specs/mobile-state-model.md` must be manually verified
- Camera flow tested on real devices (simulator camera is limited)
- Auth flow tested end-to-end (register, login, logout, Google OAuth)
- Membership state tested for all tiers (anonymous, free, pro, lifetime)
- Deep links tested
- Release checklist in `/docs/checklists/mobile-release-checklist.md` must be 100% complete

## App Store Review Readiness
- No placeholder content
- No dead links
- All permissions have human-readable descriptions
- Camera permission: "Orangutany uses your camera to photograph mushrooms for identification"
- Photo library permission: "Orangutany accesses your photos so you can identify mushrooms from existing pictures"
- No confusing payment flows (upgrade opens Safari, not in-app)
- Privacy policy accessible from app and store listing
