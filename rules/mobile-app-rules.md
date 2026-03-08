# Mobile App Engineering Rules

## Architecture Boundaries
- Mobile app is a Capacitor shell wrapping the existing Next.js web app
- Native code exists ONLY for: camera, photo picker, deep linking, app lifecycle
- All business logic lives in the web layer — no duplication in native code
- Mobile changes must NOT break the web app. Run `npm run check && npm test && npx next build` before every commit
- Shared modules go in `/lib/` — do not scatter logic across platform-specific files

## Coding Standards
- TypeScript throughout (no raw JS in new mobile code)
- No silent assumptions — if state is unknown, show a loading/error state, never guess
- No hardcoded production secrets in source — use environment variables or Capacitor config
- No logic duplication — if web and mobile need the same logic, extract to a shared module
- No `any` types — use explicit interfaces for all data flowing between web and native

## State Rules
- Every UI state must map to a defined state in `/docs/specs/mobile-state-model.md`
- No UI behavior may exist without a corresponding state definition
- State must be derived from authoritative backend data, never from local assumptions
- If state is ambiguous or loading, show explicit loading UI — never show stale data as current

## Review Constraints
- All mobile code changes require build verification on both iOS and Android
- Membership/auth changes require state-model verification against the state table
- No PR may be merged if `npm run check`, `npm test`, or `npx next build` fails

## Release Constraints
- Every release must pass the checklist in `/docs/checklists/mobile-release-checklist.md`
- No release without explicit app store metadata review
- No release with placeholder content, dead links, or broken flows
- Privacy strings and permission descriptions must be human-reviewed before submission

## What Must Never Happen
- Signed-in Pro user sees "upgrade to pro"
- Anonymous user enters a broken payment flow
- Membership state is unknown, implied, or stale
- App looks like a browser tab in a costume
- Claude depends on chat context instead of repo instructions
- Native shell breaks normal web behavior
