# Mobile (Capacitor) Readiness Audit -- Auth Flow

**Date**: 2026-03-07
**Scope**: Auth state management, session handling, Google OAuth, upgrade flow, UI responsiveness

---

## 1. Session Cookies in Capacitor WebView -- ISSUE

**File**: `/Users/varunvaid/amushroom/src/auth.js` (lines 74-88)

The session cookie is set with:
- `HttpOnly` -- fine
- `SameSite=Lax` -- **ISSUE**: Capacitor on iOS uses WKWebView which loads content from `capacitor://localhost` (iOS) or `http://localhost` (Android). Cookies set by the remote server with `SameSite=Lax` will be treated as cross-site and **silently dropped** by the WebView. The cookie domain is implicit (server domain), but the WebView origin is `capacitor://localhost`.
- `Secure` -- set in production, which blocks cookies on non-HTTPS origins (`capacitor://` is not HTTPS)

**Impact**: Auth will completely fail in Capacitor. Users cannot log in or stay logged in.

**Fix required**:
- Option A: Use token-based auth (store JWT/session token in Capacitor Preferences instead of cookies) for the mobile app
- Option B: Configure Capacitor to use the server URL as the WebView origin (server-side rendering mode) -- but this loses offline capability
- Option C: Set `SameSite=None; Secure` and proxy all requests through the server origin -- complex

## 2. Google OAuth Redirect Flow -- ISSUE

**File**: `/Users/varunvaid/amushroom/frontend/components/auth/google-button.tsx` (line 12)

Google OAuth uses a server redirect flow:
```
window.location.href = "/api/auth/google"
```

The callback is hardcoded to `APP_BASE_URL/api/auth/google/callback` (`server.js` line 149).

**Problems in Capacitor**:
1. The redirect to Google works (opens in WebView), but the callback URL points to `orangutany.com/api/auth/google/callback` -- after Google redirects back, the WebView navigates to the web URL instead of staying in the app
2. Google's OAuth consent screen may block requests from non-standard origins (`capacitor://localhost`)
3. The `pendingUpgradePlan` stored in `sessionStorage` (use-upgrade.tsx line 42-45) will survive the redirect only if the WebView stays on the same origin -- it won't if the redirect goes to the web URL

**Fix required**:
- Use Capacitor's Browser plugin or AppAuth pattern: open Google OAuth in an in-app browser, intercept the callback via deep link / custom URL scheme
- Register a custom URL scheme (e.g., `orangutany://auth/callback`) as an allowed redirect URI in Google Console
- On callback, extract the auth code, exchange it server-side, return a session token

## 3. Origin/CSRF Validation -- ISSUE

**File**: `/Users/varunvaid/amushroom/server.js` (lines 375-393)

`requireSameOrigin()` checks the `Origin` header against `APP_BASE_URL`. In Capacitor:
- iOS WKWebView sends `Origin: capacitor://localhost`
- Android WebView sends `Origin: http://localhost`

Neither matches `https://orangutany.com`. All POST endpoints (login, register, logout, identify, checkout, forgot-password, reset-password, story save, feedback) will return **403 "Blocked by origin policy"**.

**Fix required**: Add `capacitor://localhost` and `http://localhost` to the allowed origins list (conditionally, or via env var for the mobile build).

## 4. Hardcoded URLs -- WARNING

**Files reviewed**: `frontend/lib/api.ts`, `frontend/components/auth/google-button.tsx`, `frontend/hooks/use-upgrade.tsx`

- API calls use **relative URLs** (`/api/auth/me`, `/api/identify`, etc.) via `apiFetch` with `credentials: "include"` -- **these will resolve against the WebView origin** (`capacitor://localhost`), not the server. All API calls will fail with network errors unless Capacitor is configured to proxy requests to the backend.
- `window.location.href = url` in checkout flow (`use-upgrade.tsx` line 57) redirects to Stripe -- this will navigate the WebView away from the app. User may not be able to return.
- `window.location.href = "/"` after logout (`header.tsx` line 102) -- works fine in Capacitor.
- External links to `guide.orangutany.com` -- fine, but will navigate inside the WebView unless intercepted.

**Fix required**:
- Configure Capacitor's `server.url` to point to the production backend, OR prefix all API calls with the backend base URL and handle CORS
- For Stripe checkout, use Capacitor Browser plugin to open checkout in an external browser, with a deep link return URL

## 5. Auth State Display for Mobile -- PASS (with caveats)

**File**: `/Users/varunvaid/amushroom/frontend/components/layout/header.tsx`

- Username is truncated with `max-w-[60px] sm:max-w-[120px]` -- good for small screens
- Pro/Lifetime badge uses responsive text: icon-only on mobile (`hidden sm:inline` for label text)
- Upgrade button shows "Pro" on mobile, "Upgrade" on desktop -- good
- Admin button present but appropriately sized
- Login/Sign Up buttons are clean and touch-friendly

**No issues** for mobile display, assuming the header renders at all (dependent on auth working).

## 6. Membership State Visibility -- PASS

- Pro badge: green for monthly, purple for lifetime, with Crown icon
- Badge links to `/account/billing`
- Upgrade button shown for free users, hidden for pro/lifetime
- Upgrade prompt also in hamburger menu for free/unauthenticated users
- Tier check: `user?.tier === "pro" || user?.tier === "pro_lifetime"` -- correct

## 7. Viewport/Responsive Issues in Auth Components -- PASS

**Files**: `auth-modal.tsx`, `login-form.tsx`, `register-form.tsx`, `google-button.tsx`

- Auth modal uses `DialogContent` with `maxWidth: "28rem"` -- fits mobile screens
- Google button is `w-full` -- good
- Forms use standard shadcn/ui components which are responsive by default
- No fixed-width elements that would overflow on mobile
- Hamburger menu is full-width with good touch targets (`py-2.5` padding)

## 8. Content Security Policy -- WARNING

**File**: `/Users/varunvaid/amushroom/server.js` (line 273-276)

CSP includes `default-src 'self'` and `X-Frame-Options: DENY`. In Capacitor:
- `'self'` resolves to `capacitor://localhost` -- requests to `orangutany.com` would be blocked by CSP
- `X-Frame-Options: DENY` should not matter (Capacitor doesn't use iframes for the main content)

**Fix required**: CSP needs to allow the backend origin explicitly when running in Capacitor.

---

## Summary

| Area | Status | Blocking? |
|------|--------|-----------|
| Session cookies | ISSUE | Yes -- auth completely broken |
| Google OAuth redirect | ISSUE | Yes -- Google login broken |
| Origin/CSRF validation | ISSUE | Yes -- all POST requests blocked |
| Hardcoded/relative URLs | WARNING | Yes -- API calls fail without proxy config |
| CSP headers | WARNING | Likely yes |
| Auth state display | PASS | No |
| Membership visibility | PASS | No |
| Responsive/viewport | PASS | No |

### Recommended Approach

The cleanest path for Capacitor is:

1. **Set Capacitor `server.url`** to `https://orangutany.com` so the WebView loads directly from the server. This makes relative URLs, cookies, and same-origin checks all work naturally. Trade-off: no offline support for the shell, but this app requires network anyway.
2. **Add mobile origins** (`capacitor://localhost`, `http://localhost`) to allowed origins as a fallback.
3. **Google OAuth**: Use Capacitor Browser plugin to open OAuth in system browser, with a deep link (`orangutany://`) to return to the app after auth.
4. **Stripe Checkout**: Same pattern -- open in system browser, deep link back.
5. **Switch to token-based auth** if `server.url` approach proves unreliable across iOS/Android WebView quirks.
