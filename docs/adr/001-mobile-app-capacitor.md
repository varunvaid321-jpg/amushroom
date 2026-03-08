# ADR 001: Capacitor for Mobile App

## Status
Accepted

## Context
Orangutany is a web-first mushroom identification product built with Next.js. We need iOS and Android apps for App Store and Play Store distribution. Options considered:

1. **Capacitor** (wraps existing web app in native shell + native plugins)
2. **React Native / Expo** (full native rewrite)
3. **TWA (Trusted Web Activity)** for Android + native iOS app
4. **PWA only** (no app store presence)

## Decision
Use Capacitor for V1.

## Rationale
- The web app already works and has all business logic implemented
- Speed to market is the priority — Capacitor ships in days, not weeks
- Native features needed are limited (camera, photo picker, deep links)
- Full RN/Expo rewrite would duplicate all existing UI, auth, payment, and identification logic
- TWA doesn't work for iOS (Apple rejects pure webview wrappers)
- PWA doesn't get App Store/Play Store distribution

## Tradeoffs
- **Pro**: fastest path, no code duplication, single codebase for web + mobile
- **Pro**: native plugins for camera/photos feel genuinely native
- **Con**: app will never feel 100% native (scrolling, transitions, gestures)
- **Con**: if app grows significantly, may need full native rewrite
- **Con**: Capacitor has smaller community than React Native

## Future Migration
If growth justifies it, Phase 2 could be a full React Native / Expo app. The backend API is already clean and would support any frontend. The web app would continue to exist alongside the native app.

## Key Architecture Decision: server.url Mode

Capacitor's default mode (bundling static HTML into the app) breaks:
- Session cookies (SameSite=Lax + Secure dropped by WKWebView from capacitor:// origin)
- All POST requests (requireSameOrigin() rejects capacitor://localhost origin)
- Google OAuth redirect flow (callback navigates away from app)
- Relative API URLs (resolve against capacitor://localhost, not the server)
- CSP (default-src 'self' blocks requests to orangutany.com)

**Solution**: Configure `server.url = "https://orangutany.com"` so the WebView loads the live site directly. This makes cookies, API calls, CORS, and OAuth all work identically to a browser. The app is a native shell around the live website with native camera/photo plugins injected.

**Tradeoff**: No offline support, but this app requires network for identification anyway. Major benefit: no need to rebuild/redeploy the app when the website changes.

## Consequences
- Mobile-specific code lives alongside the Next.js project
- WebView loads live site — web deploys automatically update the mobile app content
- Native plugins (camera, deep links) are injected into the live WebView
- Must ensure web changes don't break mobile shell
- Must handle App Store payment policies carefully (see subscription-rules.md)
