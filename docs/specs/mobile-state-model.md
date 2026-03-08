# Mobile App State Model

Every UI state in the app must map to a defined state below. No UI behavior may exist without a corresponding state definition.

## Auth States

| State | Source | UI |
|-------|--------|-----|
| `auth_loading` | App just launched, `/api/auth/me` in flight | Splash screen or skeleton |
| `auth_signed_out` | `/api/auth/me` returns 401 | Sign in / Sign up CTA in header |
| `auth_signed_in` | `/api/auth/me` returns user object | User name + tier badge in header |
| `auth_error` | `/api/auth/me` network failure | Retry button, offline indicator |

## Membership States

| State | Source | UI |
|-------|--------|-----|
| `tier_anonymous` | No auth session | "Sign in to track scans" |
| `tier_free` | user.tier === 'free' | Scan count visible, "Upgrade to Pro" CTA |
| `tier_pro` | user.tier === 'pro' | Green Pro badge, no upgrade prompts, no scan count |
| `tier_pro_lifetime` | user.tier === 'pro_lifetime' | Purple Lifetime badge, no upgrade prompts, no scan count |
| `tier_expired` | user.tier === 'free' AND user.membershipExpiresAt is past | "Your Pro expired" + reactivation CTA |

## Upload States

| State | Source | UI |
|-------|--------|-----|
| `upload_idle` | No upload in progress | Upload area with camera/gallery prompt |
| `upload_selecting` | Camera/gallery picker open | Native picker overlay |
| `upload_previewing` | Image selected, not yet analyzed | Image preview + "Analyze" button |
| `upload_analyzing` | Analysis in progress | Loading spinner, disable analyze button |
| `upload_complete` | Results received | Results display |
| `upload_error` | Analysis failed | Error message + retry |
| `upload_quota_exceeded` | 403 from API | For free: "Daily limit reached" / For pro: silently disable analyze button |

## Connectivity States

| State | Source | UI |
|-------|--------|-----|
| `online` | Network available | Normal operation |
| `offline` | No network | Banner: "You're offline. Connect to identify mushrooms." |
| `slow` | Request timeout > 10s | Loading indicator persists, no special UI |

## App Boot States

| State | Trigger | Next State |
|-------|---------|------------|
| `boot_splash` | App launched | `boot_loading_auth` |
| `boot_loading_auth` | Splash shown, checking auth | `auth_signed_in` or `auth_signed_out` |
| `boot_ready` | Auth resolved, web content loaded | Normal app operation |
| `boot_error` | Web content failed to load | Error screen with retry |

## Error States

| State | Trigger | UI |
|-------|---------|-----|
| `error_network` | Any network request fails | Contextual error + retry |
| `error_server` | 5xx from backend | "Something went wrong. Try again." |
| `error_auth_expired` | 401 on authenticated request | Redirect to sign in |
| `error_camera_denied` | Camera permission denied | "Camera access needed" + link to settings |
| `error_gallery_denied` | Photo library permission denied | "Photo access needed" + link to settings |

## State Rules
1. If state is loading or unknown, show loading UI — never show stale data
2. State transitions must be logged in development mode for debugging
3. No UI may render without checking the relevant state first
4. State must be refreshed on app foregrounding (user may have changed subscription on web)
