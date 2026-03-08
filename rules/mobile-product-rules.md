# Mobile Product Rules

## What The App Is
The mobile app is a packaged version of the Orangutany web product with selective native enhancement. It must feel like a real app, not a lazy web wrapper.

## V1 Feature Scope

### Must Support
1. Browse the full Orangutany site (all pages, navigation, content)
2. Identify/analyze image flow with native camera and gallery integration
3. Auth/session awareness (signed in / signed out state visible at all times)
4. Membership/Pro upgrade awareness (free vs pro state always clear)
5. Proper signed-in vs signed-out UX throughout
6. Deep linking to species pages and articles
7. Native splash screen and app icon
8. Safe area / notch handling on all devices

### Must NOT Do (V1)
- Push notifications (phase 2)
- Offline species database (phase 2)
- In-app purchase (see subscription-rules.md for policy)
- Social features
- Offline image analysis

## UX Rules

### Account State Visibility
The app must clearly show at all times:
- **Signed out**: show sign up / sign in CTA
- **Signed in, free**: show upgrade CTA, current tier
- **Signed in, pro**: show Pro badge, suppress upgrade prompts
- **Expired**: show renewal/reactivation path

### Image Upload Flow
Must provide a native-feeling path for:
- Take photo with device camera
- Choose from photo gallery
- Upload into the existing identify/analyze experience
- Show upload progress

### App Shell Quality
- Polished splash/loading state
- No raw browser chrome (no URL bar, no browser navigation buttons)
- Mobile-safe viewport handling
- Proper spacing on iPhone and Android
- Handle safe areas/notches correctly
- Status bar styled to match app theme

### What Must NOT Happen
1. App shows "upgrade to pro" to a signed-in Pro user
2. Anonymous user gets dumped into a broken payment flow
3. Membership state is unknown or implied
4. App looks or feels like a browser tab
5. Navigation breaks or shows browser-style back/forward
