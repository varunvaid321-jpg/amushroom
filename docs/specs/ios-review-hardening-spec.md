# iOS Review Hardening Spec

## Purpose

Harden the iOS app for App Store review by suppressing payment surfaces, ensuring minimum native functionality, preparing account deletion, and documenting privacy disclosures.

## Risks Addressed

| Risk | Apple Guideline | Mitigation |
|------|----------------|------------|
| External payment prompts for digital goods | 3.1.1 | Suppress all upgrade/pricing CTAs via `canShowUpgradeCTA()` when `isNativeApp()` returns true |
| Minimum functionality — app feels like a browser wrapper | 4.2 | Native camera, gallery picker, safe-area handling, splash screen, mobile-optimized UI |
| No in-app account deletion | 5.1.1(v) | Add in-app deletion initiation (currently email-only) |
| Privacy disclosures don't match collection | 5.1.2 | Complete privacy inventory, enumerate App Privacy labels |
| Reviewer confusion | — | Prepare reviewer notes with test account and test steps |

## Payment Suppression

All upgrade and pricing CTAs are hidden when `isNativeApp()` returns true. The single gate is `canShowUpgradeCTA()` in `/frontend/lib/app-review-policy.ts`.

Behavior:
- `canShowUpgradeCTA()` returns `false` when `isNativeApp()` is `true`.
- Components that show upgrade prompts, pricing cards, or purchase links check this function before rendering.
- Pro badge, membership state display, and Stripe portal links (Manage Subscription, View Receipts) remain visible — these are informational.
- Post-purchase confirmation banners remain visible — they confirm a completed action.

See `/docs/specs/ios-payment-surface-audit.md` for the complete surface-by-surface audit.

## Minimum Functionality

These must work before submission:

- **Camera capture**: Native camera via Capacitor Camera plugin, integrated in photo-slots.tsx.
- **Gallery picker**: Photo library access via same Capacitor Camera plugin with gallery source.
- **Safe-area handling**: Content respects notch, home indicator, status bar via `safe-area-inset-*` CSS.
- **Splash screen**: Capacitor Splash Screen plugin configured, displays during app load.
- **Mobile-friendly UI**: No hover-only controls, no browser chrome visible, touch targets >= 44pt.

## Account Deletion

**Status**: NOT IMPLEMENTED in-app. Currently email-only via support@orangutany.com.

**Required**: In-app account deletion initiation before App Store submission. This is BLOCKING.

See `/docs/specs/account-deletion-spec.md` for the implementation spec.

## Privacy Inventory

A complete data collection inventory is maintained at `/docs/specs/app-privacy-inventory.md`. This document maps to the App Privacy label categories required in App Store Connect.

## Reviewer Notes

A draft of reviewer notes is at `/docs/release/app-review-notes-draft.md`. Before submission:
- Create a test account with credentials documented in the notes.
- Verify all test steps work on the build being submitted.
