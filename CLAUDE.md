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
- **Hosting**: Render (auto-deploys from main)
- **Domain**: orangutany.com (Cloudflare DNS)
- **Email domain**: noreply@orangutany.com (verified via Resend + Cloudflare DKIM/SPF/DMARC)

## Code Quality Rules
- Run `npm run check` before every commit — must pass
- Run `npm test` before every commit — must pass
- No dead code, no unused files, no orphan branches
- No console.log unless intentional server logging
- Security-first: validate inputs server-side, never trust client MIME types

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
