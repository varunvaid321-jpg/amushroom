# iOS Review Hardening Checklist

Deterministic pass/fail. Every item must pass before App Store submission.

## Payment Suppression

Test each surface with `isNativeApp()` returning true. No upgrade CTA, pricing, or purchase link should be visible.

| # | Surface | File | Pass/Fail |
|---|---------|------|-----------|
| 1 | Header "Upgrade" sparkle button | `header.tsx:83-92` | |
| 2 | Hamburger menu "Upgrade to Pro" item | `header.tsx:133-141` | |
| 3 | Upload panel "Go Pro" link (quota text) | `upload-panel.tsx:79-81` | |
| 4 | Upload panel anonymous block "Upgrade to Pro" link | `upload-panel.tsx:84-101` | |
| 5 | Upload panel free-tier UpgradeCard | `upload-panel.tsx:103` | |
| 6 | Results dock anonymous soft wall "Upgrade to Pro" link | `results-dock.tsx:92-144` | |
| 7 | Results dock free-tier "Upgrade to Pro" nudge | `results-dock.tsx:250-258` | |
| 8 | Upgrade modal (entire modal) | `upgrade-modal.tsx` | |
| 9 | Upgrade page (full pricing page) | `upgrade/page.tsx` | |
| 10 | Billing page free-tier "Upgrade to Pro" link | `billing/page.tsx:128-135` | |
| 11 | Billing page monthly→lifetime "Upgrade to Lifetime" button | `billing/page.tsx:148-153` | |

Allowed surfaces (verify they do NOT contain purchase paths):

| # | Surface | File | Verified |
|---|---------|------|----------|
| 12 | Billing page Stripe portal (Manage/Receipts) | `billing/page.tsx:138-167` | |
| 13 | Home page "Welcome to Pro!" success banner | `page.tsx:92-106` | |

## Native Functionality

| # | Item | Pass/Fail |
|---|------|-----------|
| 1 | Camera capture opens native camera and returns photo | |
| 2 | Gallery picker opens photo library and returns photo | |
| 3 | Safe-area insets respected (notch, home indicator, status bar) | |
| 4 | Splash screen displays during app load, dismisses cleanly | |
| 5 | No hover-only controls (all interactive elements work with tap) | |
| 6 | No browser chrome visible (address bar, navigation buttons) | |

## Account Deletion

| # | Item | Pass/Fail |
|---|------|-----------|
| 1 | "Delete Account" button exists in-app (billing or account page) | |
| 2 | Confirmation dialog shown before deletion | |
| 3 | Deletion completes successfully with test account | |
| 4 | User redirected to home after deletion | |

## Privacy

| # | Item | Pass/Fail |
|---|------|-----------|
| 1 | `/docs/specs/app-privacy-inventory.md` exists and is current | |
| 2 | App Privacy details enumerated in App Store Connect | |
| 3 | Privacy Policy URL accessible and accurate | |
| 4 | Privacy Policy mentions all third-party services (Kindwise, Stripe, Google, Resend, ip-api.com, Turso) | |

## Reviewer Readiness

| # | Item | Pass/Fail |
|---|------|-----------|
| 1 | `/docs/release/app-review-notes-draft.md` exists | |
| 2 | Test account created with working credentials | |
| 3 | Test steps verified on submission build | |
| 4 | Open issues documented and none are unresolved blockers | |
