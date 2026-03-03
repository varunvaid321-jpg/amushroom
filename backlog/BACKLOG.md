# aMushroom Backlog

Only includes items you explicitly requested.

Last updated: 2026-02-22

## Applied Now

### BG-001 GitHub + PR quality workflow
- Status: Done
- Scope completed:
- [x] Git initialized and baseline committed
- [x] CI workflow added
- [x] PR template added
- [x] Issue templates added
- [x] Check/test scripts added (`npm run check`, `npm test`)

### BG-002 Backlog management markdown structure
- Status: Done
- Scope completed:
- [x] Backlog folder created
- [x] Single canonical backlog file created (`backlog/BACKLOG.md`)

## Remaining Items

### BG-003 Commercial launch for `amushroom.com`
- Status: In Progress
- Acceptance Criteria:
- [x] Public legal pages added (`/terms.html`, `/privacy.html`, `/refund.html`)
- [x] Operational baseline added (`/healthz`, `/readyz`, rate limiting, stronger security headers)
- [x] Crawler baseline added (`/robots.txt`, `/sitemap.xml`)
- [ ] Mobile/tablet UI QA completed for homepage + auth flows before go-live (see `BG-017`)
- [ ] Production deployment live
- [ ] Domain + HTTPS configured
- [ ] Environment secrets configured securely

### BG-004 User registrations
- Status: Done
- Acceptance Criteria:
- [x] Email/password registration and login
- [x] Account session management

### BG-005 Google auth
- Status: Done
- Acceptance Criteria:
- [x] Google OAuth sign-in
- [x] Google login linked to user account model

### BG-014 Scan quotas and usage limits
- Status: Todo
- Priority: P1
- Acceptance Criteria:
- [ ] Define scan limits by tier (anonymous, free account, member) and reset periods (daily/monthly)
- [ ] Enforce quota server-side before `/api/identify` processing (user-based, with IP fallback for anonymous)
- [ ] Return clear limit-reached messaging with retry/reset timing and upgrade path copy
- [ ] Show remaining scan usage in UI/account for signed-in users
- [ ] Add admin/config controls for limits without code changes (env/config)
- [ ] Add tests for quota enforcement, reset behavior, and anonymous abuse controls

### BG-015 Monetization strategy and pricing (freemium + memberships + scan packs)
- Status: Todo
- Priority: P1
- Acceptance Criteria:
- [ ] Define pricing model for anonymous/free/member users (scan limits, reset periods, upgrade triggers)
- [ ] Define subscription tiers (e.g., Plus/Pro) with monthly scan allowances and feature gates
- [ ] Define pay-as-you-go scan packs (sizes, pricing, expiry policy) for non-subscribers/casual users
- [ ] Set target margins using API cost per scan + infra/storage assumptions
- [ ] Create paywall/upgrade copy and UX rules (remaining scans, limit reached, upgrade prompts)
- [ ] Document launch pricing assumptions and review cadence

### BG-016 Location capture for identifications (profile default + per-upload selection)
- Status: Todo
- Acceptance Criteria:
- [ ] Add optional location at upload (manual place entry and/or device location with permission)
- [ ] Allow users to save a default location in account profile and override it per scan
- [ ] Store location with each identification record (with clear precision level: exact/approximate/manual)
- [ ] Show clear privacy controls and copy (optional, user-controlled, can edit/remove)
- [ ] Include location in saved identification details and future filtering/search hooks
- [ ] Add tests for permission-denied, manual entry, profile default, and per-upload override behavior

### BG-006 Monetization via membership
- Status: Todo
- Acceptance Criteria:
- [ ] Membership plans defined
- [ ] Membership billing flow implemented
- [ ] Feature gating by membership tier

### BG-007 Monetization via sales
- Status: Todo
- Acceptance Criteria:
- [ ] Product/offer checkout flow
- [ ] Purchase confirmation and access delivery

### BG-008 Design token strategy across website + app
- Status: Todo
- Acceptance Criteria:
- [ ] Single source-of-truth token file approved
- [ ] Web and app token mappings documented
- [ ] Theming consistency validated across both platforms

### BG-009 Multi-instance-safe OAuth state handling
- Status: Todo
- Acceptance Criteria:
- [ ] Google OAuth state survives multi-instance deployments and restarts
- [ ] OAuth callback validation works behind load balancers without sticky sessions
- [ ] State storage uses shared persistence (DB/Redis) or signed stateless state

### BG-010 Uploaded image retention and anonymous storage policy
- Status: Todo
- Acceptance Criteria:
- [x] Anonymous identify requests do not persist raw image blobs by default
- [ ] Add retention/cleanup policy for stored image blobs and match records
- [ ] Add controls to limit storage abuse/cost (TTL, quotas, or auth-only persistence)

### BG-011 Account launch hardening (separate PR)
- Status: Todo
- Acceptance Criteria:
- [ ] Require Google `email_verified=true` before linking a Google account to an existing email/password account
- [ ] Add signup consent checkbox for Terms + Privacy on account registration UI
- [ ] Store consent acceptance timestamp and policy version(s) in the database
- [ ] Add tests for Google linking verification requirement and signup consent enforcement

### BG-012 Professional camera capture + permission UX
- Status: Todo
- Acceptance Criteria:
- [ ] Add HTTPS-ready live camera capture flow (`getUserMedia`) with in-page preview/capture UI
- [ ] Request camera permission only on user action and show clear allow/deny/unavailable messages
- [ ] Fallback to photo upload when camera is blocked, unsupported, or desktop browser ignores capture behavior
- [ ] Stop camera stream immediately after capture/close to avoid background camera use
- [ ] Document mobile vs desktop camera behavior expectations in UI copy/help text

### BG-013 Two-factor authentication (2FA)
- Status: Todo
- Acceptance Criteria:
- [ ] Add TOTP-based 2FA setup flow (authenticator app) with QR code + manual key
- [ ] Add 2FA login challenge step after password for enabled accounts
- [ ] Add backup/recovery codes (generated once, stored hashed)
- [ ] Add enable/disable 2FA controls in Account page
- [ ] Encrypt TOTP secret at rest and rate-limit 2FA verification attempts
- [ ] Add tests for setup, login challenge, recovery code use, and disable flow

### BG-017 Hero headline wrap polish + mobile UI QA
- Status: Todo
- Acceptance Criteria:
- [ ] Adjust homepage hero headline wrapping so `Identify wild mushrooms from photos.` does not look awkward on desktop widths
- [ ] Test homepage and auth page layouts on mobile breakpoints (including common phone widths) and tablet
- [ ] Fix any layout/spacing/overflow issues found during mobile UI QA

### BG-018 Security hardening gap closure + launch-ready safeguards
- Status: Todo
- Priority: P0
- Notes:
- Consolidates security review findings so nothing is missed before go-live
- Track with and cross-check related items: `BG-009`, `BG-010`, `BG-011`, `BG-012`, `BG-013`
- Acceptance Criteria:
- [ ] Google OAuth state is bound to the initiating browser/session (replay/login-CSRF resistant), not only an in-memory server map
- [ ] Google OAuth state handling is safe across multi-instance deployments/restarts (shared persistence or signed stateless state) (`BG-009`)
- [ ] Require Google `email_verified=true` before linking to existing email/password accounts (`BG-011`)
- [ ] Add explicit/verified account-linking policy for existing accounts (do not silently link on email match without verification/session checks)
- [ ] Sanitize/allowlist upstream URLs before rendering links/images in UI (block `javascript:`, unsafe `data:` links, malformed URLs)
- [ ] Server validates actual uploaded image bytes (magic bytes/decode) instead of trusting client MIME metadata only
- [ ] Server rejects unsupported/corrupt/non-image payloads before upstream API calls and before DB persistence
- [ ] Upload persistence policy finalized and implemented (retention/cleanup TTL, limits, deletion path) (`BG-010`)
- [ ] Add user-facing delete/export controls or documented policy for saved scans/photos (if not launch-ready, clearly document limitation)
- [ ] Add outbound request timeouts/abort handling and error budgets for identify API, Google OAuth token/profile fetches, and email provider calls
- [ ] Tighten CSRF/browser request protections beyond current same-origin checks (e.g., `Origin` + Fetch Metadata and/or CSRF token strategy for state-changing endpoints)
- [ ] Review session cookie hardening for production (`Secure`, `HttpOnly`, `SameSite`, optional `__Host-` prefix) and add startup/proxy config checks to prevent insecure deployment
- [ ] Confirm HTTPS/HSTS behavior in production deployment path and document proxy/header requirements (`TRUST_PROXY`, forwarded proto/host expectations)
- [ ] Add abuse-resilience tests for auth and upload flows (rate limits, oversized payloads, malformed JSON, invalid MIME/base64)
- [ ] Add runtime security tests for OAuth callback state validation, Google linking verification requirement, and CSRF/origin enforcement (not regex-only tests)
- [ ] Add frontend safety tests/checks for unsafe URL rendering and DOM injection regressions in result rendering and saved identifications
- [ ] Add a simple threat-model checklist covering auth, upload abuse, saved image privacy, third-party API trust, and admin/ops misconfiguration risks

### BG-020 Password change / account settings
- Status: Todo
- Priority: P1
- Acceptance Criteria:
- [ ] Add account settings page with password change form (current password + new password + confirm)
- [ ] Server endpoint `POST /api/auth/change-password` with current password verification
- [ ] Validation: enforce same password rules as registration
- [ ] Success: invalidate other sessions, keep current session active
- [ ] UI accessible from header user menu

### BG-019 Security posture documentation + publishable safety claims
- Status: Todo
- Priority: P1
- Notes:
- Goal: maintain evidence-backed documentation for internal review and future public-facing trust/safety messaging
- Acceptance Criteria:
- [ ] Create internal security architecture doc covering auth/session, Google OAuth flow, upload handling, storage, camera permissions, and data retention
- [ ] Document implemented protections with exact behavior and limits (security headers/CSP, cookie flags, rate limits, origin policy, upload validation, auth checks)
- [ ] Document third-party dependencies and trust boundaries (Google OAuth, identification API, email provider) and what data is sent to each
- [ ] Document incident response basics: how to rotate secrets, invalidate sessions, disable Google auth, and handle abuse reports
- [ ] Document privacy/data lifecycle for user photos and saved identifications (what is stored, for how long, how deletion works)
- [ ] Create a verification checklist for every release/go-live covering security config, env vars, HTTPS, and tests
- [ ] Create a public-facing "How we keep your data safe" page/section with only claims backed by implemented controls and testable evidence
- [ ] Include version/date and last-reviewed timestamp on security docs so future claims stay accurate
