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
- [ ] Production deployment live
- [ ] Domain + HTTPS configured
- [ ] Environment secrets configured securely

### BG-004 User registrations
- Status: Done
- Acceptance Criteria:
- [x] Email/password registration and login
- [x] Account session management

### BG-005 Google account login
- Status: Done
- Acceptance Criteria:
- [x] Google OAuth sign-in
- [x] Google login linked to user account model

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
