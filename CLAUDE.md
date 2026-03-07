# Orangutany — Claude Code Guidelines

## Project Overview
Mushroom identification web app (orangutany.com). Users upload photos, get AI-powered identification via Kindwise API. Supports email/password and Google OAuth login. 3-tier quota system: anonymous (5 total by IP), free (5/day), pro (unlimited, future).

## Tech Stack

### Backend
- **Runtime**: Node.js (vanilla HTTP server, no framework)
- **Database**: SQLite via better-sqlite3
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

## Code Quality Rules
- Run `npm run check` before every commit — must pass
- Run `npm test` before every commit — must pass
- No dead code, no unused files, no orphan branches
- No console.log unless intentional server logging
- Security-first: validate inputs server-side, never trust client MIME types

## Async/Await Safety (CRITICAL after Turso migration)
- **Every DB function in `src/db.js` is async** — ALL calls must use `await`
- **Every handler that touches the DB is async** — route dispatcher must `await` them
- When adding new routes or handlers: always check if the function is async, and await it
- When migrating any sync API to async: grep ALL call sites and add `await` — missing even one causes silent data corruption (Promises serialize as `{}`)
- **Test to add**: `npm test` includes a check that all `getAuthContext` calls are awaited — extend this pattern to cover all async DB functions if new ones are added

## Sitemap Architecture (orangutany.com + guide.orangutany.com)
- Two sitemaps — Google requires sitemap URLs to match host (subdomains are separate sites)
- orangutany.com/sitemap.xml — 16 pages (app, learn articles, legal) via `frontend/app/sitemap.ts`
- guide.orangutany.com/sitemap.xml — 106 species + articles + guides via `app/sitemap.ts` in orangutany-seo repo
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

## Git Workflow
- Push directly to main (solo dev, Render auto-deploys)
- Commit messages: imperative mood, explain "why" not "what"

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
