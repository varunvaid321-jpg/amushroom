# Orangutany — Claude Code Guidelines

## Project Overview
Mushroom identification web app (orangutany.com). Users upload photos, get AI-powered identification via Kindwise API. Supports email/password and Google OAuth login. Stripe payments (monthly $7.99, lifetime $49.99).

## Tech Stack

### Backend
- **Runtime**: Node.js (vanilla HTTP server, no framework)
- **Database**: SQLite via Turso (@libsql/client)
- **Email**: Resend API (transactional emails — welcome, password reset)
- **Auth**: Session-based (scrypt passwords) + Google OAuth 2.0
- **AI**: Kindwise API for mushroom identification

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS v4, shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Utilities**: clsx, tailwind-merge, class-variance-authority

### Infrastructure
- **Hosting**: Render Starter plan ($7/mo USD) — auto-deploys from main
- **Domain**: orangutany.com (Cloudflare DNS)
- **Email domain**: noreply@orangutany.com (verified via Resend + Cloudflare DKIM/SPF/DMARC)

## Render Env Var Safety (CRITICAL — caused production outage March 5 2026)
- **Render PUT /env-vars REPLACES ALL vars** — if you PUT only new vars, everything else is deleted
- **MANDATORY procedure for ANY env var change**:
  1. `GET /v1/services/{id}/env-vars` — fetch all current vars
  2. Merge new/changed vars into the full list
  3. `PUT` the complete merged set
  4. `GET` again to verify all vars are present
- **Local backup**: `.env.production` contains all production credentials — update it whenever env vars change
- **Never store credentials only on Render** — if they get wiped, they're gone forever

## Cost Rules (MANDATORY)
- **Render plan is Starter ($7/mo USD). NEVER upgrade the plan, add instances, enable autoscaling, or make any change that increases cost beyond $7/mo.**
- Do not add paid databases, paid add-ons, or additional Render services
- Do not add any third-party service that incurs cost without explicit user approval
- 1 instance only — no horizontal scaling
- If a feature would require a plan upgrade to work, flag it to the user instead of implementing
- Only Varun can authorize cost increases — never assume or auto-upgrade

## API Key Security (MANDATORY)
- **NEVER store API keys, secrets, or tokens in memory files, CLAUDE.md, or any committed file**
- All secrets live in `.env.production` (gitignored, local only) — this is the single source of truth for credentials
- Reference keys by env var name (e.g., `$CLOUDFLARE_API_KEY`, `$RENDER_API_KEY`), never by value
- When you need a key value, read it from `.env.production` at runtime
- Production secrets also stored in Render env vars (16 vars — see Render Env Var Safety section)

## Code Quality Rules
- Run `npm run check` before every commit — must pass
- Run `npm test` before every commit — must pass
- No dead code, no unused files, no orphan branches
- No console.log unless intentional server logging
- Security-first: validate inputs server-side, never trust client MIME types

## Image Serving Rules (CRITICAL — caused regression chain March 11 2026)
- **NEVER embed base64 image blobs in JSON API responses** — use URL references to `/api/uploads/{id}/cover-image` instead. Inline blobs cause massive payloads, slow responses, and spinners.
- **Image-serving endpoints MUST be above the global rate limiter** in server.js — thumbnail `<img src>` tags fire many parallel requests that hit the rate limit otherwise.
- **Every `<img>` tag with an API-served `src` MUST have an `onError` handler** — URL-based images can fail (404, network). Show a fallback or hide the image. Never show a broken image icon.
- **Frontend types must match backend nullability** — if the DB can return `null` (e.g. `primaryConfidence`), the TypeScript interface must say `number | null`, not `number`. Otherwise arithmetic produces `NaN`.
- **All email sends must be fire-and-forget** (`.catch(() => {})`) unless the caller needs to know about failure (e.g. password reset). A failed email must never block a user-facing response.

## Turso/libsql SQL Safety (CRITICAL — caused production outage March 10 2026)
- **NEVER use `IN (?,?,?)` with array args** — Turso doesn't support spreading arrays into positional placeholders. Use individual queries per value instead.
- **Always test new DB queries against Turso via the running dev server** — `npm run check` only validates syntax, not runtime SQL. Start the dev server and hit the actual endpoint before pushing.
- **Unhandled DB errors crash the entire Node process** — one broken endpoint takes down ALL APIs including auth. Always wrap new DB queries in try/catch or ensure they're tested.

## Async/Await Safety (CRITICAL after Turso migration)
- **Every DB function in `src/db.js` is async** — ALL calls must use `await`
- **Every handler that touches the DB is async** — route dispatcher must `await` them
- When adding new routes or handlers: always check if the function is async, and await it
- When migrating any sync API to async: grep ALL call sites and add `await` — missing even one causes silent data corruption (Promises serialize as `{}`)
- **Test to add**: `npm test` includes a check that all `getAuthContext` calls are awaited — extend this pattern to cover all async DB functions if new ones are added

## Payment System Rules (CRITICAL — read /docs/orangutany-payment-spec.md before ANY payment work)

### Mandatory spec reference
Before modifying ANY payment, billing, upgrade, membership, or Stripe code, read `/docs/orangutany-payment-spec.md` (v2.0). Do not deviate from it.

### Pro scan cap is SILENT (NEVER leak to users)
- Pro users have a 50/day scan cap. This is internal fraud prevention.
- **NEVER** show "50 scans", "unlimited scans", "daily limit", or any scan count to Pro users in UI text, error messages, or API responses.
- When Pro user hits cap: analyze button silently disables. No error message, no explanation.
- Server 403 for Pro returns `"Please try again later."` with `limit: null` — never the actual number.
- Free/anonymous users DO see their remaining count (e.g. "3 of 5 daily scans remaining").

### Payment architecture (do not change pattern)
- Stripe Checkout Sessions + Webhooks (NOT payment links). Zero payment links allowed.
- Auth required before checkout (`getAuthContext()` returns 401 if not authenticated).
- Membership changes ONLY via webhook — never from frontend or direct API call.
- Webhook returns 500 on application errors so Stripe retries.
- Monthly subscription auto-cancelled on lifetime upgrade.
- Pending upgrade plan stored in `sessionStorage` (survives OAuth redirect).
- `useUpgrade` hook is the single entry point for all upgrade flows.

### Known payment edge cases (CAUTION — from March 11 2026 audit)
- **Lifetime upgrade sends wrong cancellation email**: When monthly→lifetime upgrade happens, Stripe fires `customer.subscription.deleted` for the old monthly sub. The webhook sends a "Your Pro was cancelled" email — but the user actually upgraded. Must check if user is now `pro_lifetime` before sending cancellation email.
- **Cancel endpoint has no rollback**: If `stripe.subscriptions.cancel()` succeeds but `downgradeUser()` fails, user keeps Pro access with a cancelled Stripe sub. No automatic recovery — must be fixed manually.
- **No audit log for renewal payments**: `invoice.payment_succeeded` creates a payment record but doesn't write to audit_log.

### Audit log (immutable)
- `audit_log` table: INSERT-only, no DELETE/UPDATE. 3-year minimum retention.
- Events: signup, login, tier_change, payment.
- Never add DELETE or UPDATE functions for audit_log.

### UI rules for membership
- Pro badge in header: green for Pro, purple for Lifetime, links to /account/billing.
- All upgrade prompts disappear for Pro/Lifetime users.
- Upgrade copy must never promise "unlimited" or reference scan numbers.

## Sitemap Architecture (orangutany.com + guide.orangutany.com)
- Two sitemaps — Google requires sitemap URLs to match host (subdomains are separate sites)
- orangutany.com/sitemap.xml — 16 pages (app, learn articles, legal) via `frontend/app/sitemap.ts`
- guide.orangutany.com/sitemap.xml — 131 species + 27 articles + guides via `app/sitemap.ts` in orangutany-seo repo
- Both robots.txt files list BOTH sitemaps for cross-discovery
- Stale `public/sitemap.xml` and `public/robots.txt` (old orangutanyID.com refs) have been deleted — dynamic `app/sitemap.ts` and `app/robots.ts` are the source of truth
- If adding pages to either site, update the corresponding sitemap.ts

## Scroll Behavior Rules (CRITICAL — broken 3 times in March 2026)

The homepage has scroll targets (`#upload`, `#results`, `#library`) triggered by hero CTA, hamburger menu, and history table clicks. These MUST land so the user sees the right content.

### Required viewport on scroll to `#upload` (phone)
The screen must clearly show ALL of these after scrolling:
1. "One photo is enough" hint text
2. All 5 upload photo boxes
3. The Analyze button / quota text / upgrade CTA

If any layout change pushes these out of a single phone viewport (~667px minus 64px header = ~600px usable), the scroll target or layout must be adjusted.

### Implementation rules
1. **Every scrollable section must have `scroll-mt-[72px]`** (64px header + 8px buffer). If you add a new `id=""` that gets scrolled to, add this class.
2. **Use `scrollToId()` from `frontend/lib/scroll.ts`** — never write raw `scrollIntoView` or `window.scrollTo` elsewhere. This function has browser fallback + safety correction.
3. **Never remove or reduce `scroll-mt-*`** classes without testing on a real phone viewport (375px wide, 667px tall).
4. **After any layout change to the upload section** (padding, spacing, new elements above the boxes), verify the scroll lands correctly:
   - Check: does the hint text show at the top?
   - Check: is the Analyze button visible without scrolling further?
   - If not, adjust `scroll-mt-*` or section padding.
5. **The safety check** in `scroll.ts` auto-corrects after 600ms if the element ends up behind the header. Do not remove this.
6. **Test targets**: `#upload` (from hero + hamburger), `#results` (after analyze on mobile), `#library` (from back-to-library button).

### What went wrong (history)
- PR #68: Used `scroll-margin-top` CSS property — some mobile browsers ignored it
- PR #69: Switched to `scrollIntoView` + `scroll-mt-*` Tailwind class — worked on desktop, inconsistent on phone
- PR #73: Added manual fallback + 600ms safety correction — most robust approach

## Git Workflow (MANDATORY — no exceptions)
- **NEVER push directly to main.** Every change — code, config, docs, CLAUDE.md, everything — must go through a PR. Create a branch, commit, push the branch, open a PR, merge. No exceptions, no shortcuts, no "it's just a doc update."
- Commit messages: imperative mood, explain "why" not "what"

## PR Report (MANDATORY — every PR must include this)
Every PR description must contain a structured report. Format depends on the type of change:

### For bug fixes — Issue/Root Cause/Fix table:
```
| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Short description | Why it happened | What was changed |
```

### For new features — Code Change Summary:
- What the feature does (1-2 sentences)
- Files added/modified and why
- Any new dependencies, env vars, or config changes

### For all PRs — End-to-End Test Results:
```
| # | Test Case | Expected | Result |
|---|-----------|----------|--------|
| 1 | Description | Expected outcome | PASS/FAIL |
```
Include boundary conditions: invalid input, missing fields, special characters, error states.
If a test fails, document the fix and re-test result.

## Session Closing Rule (MANDATORY)
Before ending a session, on context compaction, or when user says "session closing":
1. Update ALL applicable `docs/*.md` and `docs/**/*.md` files with work completed this session
2. Update `docs/open-issues.md` — mark resolved issues, add new ones discovered
3. Update `docs/progress/mobile-app-progress.md` — mark completed items with dates
4. Update memory files (`~/.claude/projects/*/memory/`) with any new learnings
5. This is non-negotiable — no session ends without docs being current

## Guardrails (before every push)
- `npm run check` must pass
- `npm test` must pass
- `npx next build` in frontend/ must pass (catches TypeScript and build errors)
- Never push if any of the above fail — fix first

## Key Files

### Backend
- `server.js` — HTTP server, routes, middleware, API proxy, quota enforcement
- `src/auth.js` — password hashing, session management
- `src/db.js` — SQLite schema, queries, quota tracking (scan_quotas, users)
- `src/google-oauth.js` — OAuth state and flow
- `src/email.js` — Resend integration (welcome + password reset emails)

### Scan Result Enrichment (AUTHORITATIVE — what we add on top of the API)

The Kindwise API returns species matches with confidence scores. Two local databases enrich those results:

**`species-lookup.json`** (130 species from guide DB, keyed by scientific name lowercase):
- Guide link → `guide.orangutany.com/mushrooms/{slug}`
- Common name from our database
- Look-alike species with:
  - Look-alike images (from our guide image library)
  - Distinction text (how to tell them apart)
  - Guide slug (if the look-alike species is also in our DB)

**`mushroom-stories.json`** (535 species with curated fun facts):
- "Did You Know?" one-liner shown in expanded card view
- Curated per-species trivia/story

**What the user sees in scan results:**
- 1-3 cards in responsive grid (accordion-style — each expands independently inline, Set<number> state)
- Tap card image for full uncropped photo lightbox (portal-rendered, scroll-locked)
- Click card to expand ProfilePanel directly below it (multiple can be open simultaneously, pushing others down)
- Expanded view: "Read Full Guide" CTA banner, story, traits, look-alikes with images, taxonomy, distribution map
- Key traits fallback: `buildFallbackTraits()` in server.js generates useful info from edibility/taxonomy/description — never shows complaint text
- Link to our guide page (if species exists in our 130-species DB)
- Look-alike entries also link to guide pages when the look-alike has a slug in our DB

**Graceful fallback:** If a species isn't in either database, no story or guide link appears. No empty holes, no broken images.

**Scripts:**
- `scripts/regenerate-species-lookup.sh` — regenerates species-lookup.json from guide database
- Both files are loaded by server.js at startup, zero external API calls for enrichment

### MANDATORY: After adding new species to guide.orangutany.com
1. Run `scripts/regenerate-species-lookup.sh` to update species-lookup.json
2. Optionally add a story entry in mushroom-stories.json
3. Commit both files in amushroom repo via PR
Skipping this means new species won't appear as guide links, show look-alike images, or display fun facts in scan results.

### Frontend
- `frontend/app/page.tsx` — Homepage (upload + identify flow)
- `frontend/app/about/page.tsx` — About page
- `frontend/app/forgot-password/page.tsx` — Password reset request
- `frontend/app/reset-password/page.tsx` — Password reset form
- `frontend/app/admin/page.tsx` — Admin dashboard
- `frontend/lib/api.ts` — API client, types (Match, QuotaInfo, etc.)
- `frontend/hooks/use-auth.ts` — Auth state hook
- `frontend/hooks/use-uploads.ts` — Upload/identify state hook
- `frontend/hooks/use-quota.ts` — Quota state hook
- `frontend/components/upload/upload-panel.tsx` — Photo upload + analyze UI
- `frontend/components/results/results-dock.tsx` — Results display + soft wall
- `frontend/components/auth/` — Login, register, Google button components

## Testing
- `npm run check` — syntax validation for all JS files
- `npm test` — runs tests in `tests/`
- No mocking — real end-to-end preferred
