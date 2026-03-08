# Mobile App Progress Tracker

**Last updated:** 2026-03-08

## Phase 1: Governance and Planning

| Item | Status | Date Started | Date Completed | Notes |
|------|--------|-------------|----------------|-------|
| Create /rules/mobile-app-rules.md | completed | 2026-03-07 | 2026-03-07 | |
| Create /rules/mobile-product-rules.md | completed | 2026-03-07 | 2026-03-07 | |
| Create /rules/subscription-rules.md | completed | 2026-03-07 | 2026-03-07 | |
| Create ADR 001 | completed | 2026-03-07 | 2026-03-07 | |
| Create mobile-app-spec.md | completed | 2026-03-07 | 2026-03-07 | |
| Create mobile-state-model.md | completed | 2026-03-07 | 2026-03-07 | |
| Create release-checklist.md | completed | 2026-03-07 | 2026-03-07 | |
| Create open-issues.md | completed | 2026-03-07 | 2026-03-07 | |
| Create progress tracker | completed | 2026-03-07 | 2026-03-07 | |

## Phase 2: Audit and Readiness

| Item | Status | Date Started | Date Completed | Notes |
|------|--------|-------------|----------------|-------|
| Mobile readiness audit | completed | 2026-03-07 | 2026-03-07 | See mobile-readiness-audit.md |
| Auth flow audit | completed | 2026-03-07 | 2026-03-07 | 3 blockers found, solved with server.url mode |
| Membership flow audit | completed | 2026-03-07 | 2026-03-07 | PASS — state display correct |
| Image upload flow audit | completed | 2026-03-07 | 2026-03-07 | Clean injection via addFile() |
| Viewport/responsive audit | completed | 2026-03-07 | 2026-03-07 | 2 blockers fixed (viewport meta, safe-area) |

## Phase 3: Capacitor Setup

| Item | Status | Date Started | Date Completed | Notes |
|------|--------|-------------|----------------|-------|
| Install Capacitor | completed | 2026-03-07 | 2026-03-07 | 7 plugins installed |
| Configure iOS platform | completed | 2026-03-07 | 2026-03-07 | Permissions, server.url, splash config |
| Configure Android platform | completed | 2026-03-07 | 2026-03-07 | Permissions, camera, server.url |
| App icons and splash | not_started | | | Need custom icons |
| Build scripts in package.json | completed | 2026-03-07 | 2026-03-07 | cap:sync, cap:ios, cap:android, mobile:build |
| First successful iOS build | not_started | | | Needs Xcode |
| First successful Android build | not_started | | | Needs Android Studio |

## Phase 4: Native Integration

| Item | Status | Date Started | Date Completed | Notes |
|------|--------|-------------|----------------|-------|
| Camera plugin integration | completed | 2026-03-07 | 2026-03-07 | capacitor-camera.ts + photo-slots.tsx |
| Photo picker integration | completed | 2026-03-07 | 2026-03-07 | Gallery source in same bridge |
| Deep linking setup | not_started | | | |
| Google OAuth in Capacitor | not_started | | | |

## Phase 5: Membership UI Refactor

| Item | Status | Date Started | Date Completed | Notes |
|------|--------|-------------|----------------|-------|
| Extract auth state types | not_started | | | |
| Extract subscription state types | not_started | | | |
| Create state selectors | not_started | | | |
| Refactor header to use state model | not_started | | | |
| Refactor upgrade prompts | not_started | | | |
| Test all state combinations | not_started | | | |

## Phase 6: Polish and Review

| Item | Status | Date Started | Date Completed | Notes |
|------|--------|-------------|----------------|-------|
| Mobile UX polish | not_started | | | |
| Safe area handling | not_started | | | |
| Status bar theming | not_started | | | |
| App store metadata | not_started | | | |
| Screenshots | not_started | | | |
| Privacy policy link | not_started | | | |
| Release checklist pass | not_started | | | |
| Final audit | not_started | | | |

## iOS Review Hardening Pass

| Item | Status | Date Started | Date Completed | Notes |
|------|--------|-------------|----------------|-------|
| iOS app review rules | completed | 2026-03-07 | 2026-03-07 | `/rules/ios-app-review-rules.md` |
| iOS review hardening spec | completed | 2026-03-07 | 2026-03-07 | `/docs/specs/ios-review-hardening-spec.md` |
| iOS review hardening checklist | completed | 2026-03-07 | 2026-03-07 | `/docs/checklists/ios-review-hardening-checklist.md` |
| Payment surface audit | completed | 2026-03-07 | 2026-03-07 | 13 surfaces audited, 11 suppressed, 2 allowed |
| Account deletion spec | completed | 2026-03-07 | 2026-03-07 | BLOCKING — not yet implemented |
| App privacy inventory | completed | 2026-03-07 | 2026-03-07 | 16 data types, 6 third-party services |
| App review notes draft | completed | 2026-03-07 | 2026-03-07 | Test account TBD |
| Open issues updated | completed | 2026-03-07 | 2026-03-07 | 5 new issues added |

## Web Payment Fixes (prerequisite for mobile)

| Item | Status | Date Started | Date Completed | Notes |
|------|--------|-------------|----------------|-------|
| Fix toPublicUser missing stripe_customer_id | completed | 2026-03-08 | 2026-03-08 | PR #97 — root cause of portal failure |
| Fix bfcache stuck spinners (portal + checkout) | completed | 2026-03-08 | 2026-03-08 | PR #97 — pageshow listeners |
| Add visible error messages for payment failures | completed | 2026-03-08 | 2026-03-08 | PR #97 — portal + checkout errors |
| Add 24 financial workflow tests | completed | 2026-03-08 | 2026-03-08 | PR #98 — 43→67 tests |
| Clean up stale git branches | completed | 2026-03-08 | 2026-03-08 | 10 branches deleted, only main + mobile-app-capacitor remain |

## Blockers
- Account deletion: in-app initiation not implemented (BLOCKING for App Store submission)
- Apple Developer Program enrollment ($99) — needed before any Xcode build or submission
