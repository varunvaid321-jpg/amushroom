# Mobile Release Checklist

Every item must be checked before submitting to App Store or Play Store.

## Build
- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] `npx next build` passes (frontend/)
- [ ] `npx cap sync` completes without errors
- [ ] iOS build succeeds in Xcode (no warnings treated as errors)
- [ ] Android build succeeds in Android Studio (no lint errors)

## App Icons and Splash
- [ ] iOS app icon set complete (all required sizes)
- [ ] Android adaptive icon set complete
- [ ] Splash screen displays correctly on both platforms
- [ ] No placeholder or default Capacitor icons remain

## Core Flows
- [ ] App launches cleanly from cold start
- [ ] Splash screen transitions to content smoothly
- [ ] Navigation works (forward, back, deep pages)
- [ ] Hardware back button works (Android)
- [ ] Safe areas / notches handled correctly (iPhone, Android)

## Auth
- [ ] Sign in flow works (email/password)
- [ ] Sign in flow works (Google OAuth)
- [ ] Sign out works
- [ ] Session persists across app restarts
- [ ] Auth state visible in header at all times

## Membership State
- [ ] Anonymous user: sees sign in CTA, limited scans
- [ ] Free user: sees scan count, upgrade CTA
- [ ] Pro user: sees Pro badge, NO upgrade prompts, NO scan count
- [ ] Lifetime user: sees Lifetime badge, NO upgrade prompts
- [ ] Expired user: sees reactivation prompt
- [ ] Upgrade flow opens in system browser (not in-app)

## Camera / Photo Flow
- [ ] "Take Photo" opens native camera
- [ ] "Choose from Gallery" opens native photo picker
- [ ] Selected image appears in upload preview
- [ ] Analyze button works after image selection
- [ ] Results display correctly after analysis
- [ ] Camera permission denial handled gracefully
- [ ] Photo library permission denial handled gracefully

## Deep Links
- [ ] orangutany.com/mushrooms/* opens in app
- [ ] orangutany.com/articles/* opens in app
- [ ] Links from outside the app open correctly

## Content Quality
- [ ] No placeholder text anywhere
- [ ] No dead links
- [ ] No broken images
- [ ] No raw browser chrome visible
- [ ] No URL bar or browser navigation buttons visible
- [ ] Status bar matches app theme

## Privacy and Permissions
- [ ] Camera usage description set (iOS Info.plist)
- [ ] Photo library usage description set (iOS Info.plist)
- [ ] Privacy policy URL accessible from app
- [ ] Privacy policy URL set in store listing
- [ ] No unnecessary permissions requested

## Store Metadata
- [ ] App name finalized
- [ ] App description written
- [ ] Screenshots prepared for all required device sizes
- [ ] App category selected
- [ ] Age rating set
- [ ] Keywords/tags set
- [ ] Support URL set
- [ ] Contact email set

## Final Verification
- [ ] Tested on real iPhone device
- [ ] Tested on real Android device
- [ ] No console errors in WebView
- [ ] No memory leaks on repeated use
- [ ] App size is reasonable (< 50MB)
