# aMushroom — Claude Code Guidelines

## Project Overview
Mushroom identification web app (amushroom.com). Users upload photos, get AI-powered identification via Kindwise API. Supports email/password and Google OAuth login.

## Tech Stack
- **Backend**: Node.js (vanilla HTTP server, no framework), SQLite (better-sqlite3)
- **Frontend**: Vanilla JS, token-driven CSS
- **Deploy**: Render (auto-deploys from main)
- **Auth**: Session-based (scrypt passwords) + Google OAuth

## Code Quality Rules
- Run `npm run check` before every commit — must pass
- Run `npm test` before every commit — must pass
- No dead code, no unused files, no orphan branches
- No console.log unless intentional server logging
- Keep server.js, app.js, auth.js focused — don't let files bloat
- Security-first: validate inputs server-side, never trust client MIME types
- All Telegram-visible messages: disable_web_page_preview where applicable

## Git Workflow
- All work on feature branches, merge via PR to main
- Squash merge preferred
- Commit messages: imperative mood, explain "why" not "what"
- Never push directly to main for non-trivial changes
- Delete branches after merge

## Key Files
- `server.js` — HTTP server, routes, middleware, API proxy
- `src/auth.js` — password hashing, session management
- `src/db.js` — SQLite schema and queries
- `src/google-oauth.js` — OAuth state and flow
- `public/scripts/app.js` — main frontend logic
- `public/scripts/auth.js` — auth page frontend
- `public/scripts/common-auth.js` — shared auth/portfolio UI
- `design/tokens/tokens.json` — design token source of truth
- `backlog/BACKLOG.md` — canonical backlog

## Testing
- `npm run check` — syntax validation for all JS files
- `npm test` — runs tests in `tests/`
- No mocking — real end-to-end preferred
