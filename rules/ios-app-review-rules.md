# iOS App Review Rules

Rules governing iOS app behavior to maintain App Store compliance.

## Payment and Upgrade CTAs

- No external payment prompts inside the iOS app for digital upgrades.
- No hidden pricing or upgrade links in native mode.
- `canShowUpgradeCTA()` in `/frontend/lib/app-review-policy.ts` is the single gate for all upgrade/pricing UI. Every component that shows upgrade or pricing content must call this function.
- Pro badge and membership state display are always allowed — these are informational, not purchase prompts.
- Free-tier limit messages (e.g., "3 of 5 daily scans remaining") must not include purchase CTAs in native mode. State the limit, do not sell.

## Policy Layer

- All app-review-sensitive UI behavior must go through the central policy layer at `/frontend/lib/app-review-policy.ts`.
- Do not scatter `isNativeApp()` checks across components for review-sensitive decisions. Route them through the policy layer.

## Native Quality

- The native app must feel intentional and useful, not a browser wrapper.
- Native camera capture, gallery picker, safe-area handling, splash screen, and mobile-optimized UI are minimum requirements.
- No hover-only controls. No visible browser chrome.

## Account Deletion

- If the app supports account creation, it must support in-app account deletion initiation (Apple Guideline 5.1.1(v)).
- The deletion path must be discoverable and testable by a reviewer.

## Privacy

- Privacy declarations in App Store Connect must match actual data collection.
- Maintain `/docs/specs/app-privacy-inventory.md` as the source of truth for what data the app collects.

## Release Readiness

- Reviewer notes must be prepared as part of release readiness (see `/docs/release/app-review-notes-draft.md`).
- A test account must be created and documented before submission.
