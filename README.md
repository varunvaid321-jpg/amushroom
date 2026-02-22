# aMushroom

Production-ready mushroom identification web app for `amushroom.com`.

## Architecture

- `server.js`: Node HTTP server, auth/session APIs, upload persistence, identification API proxy, static file hosting
- `src/db.js`: SQLite schema + data access
- `src/auth.js`: password/session helpers
- `src/google-oauth.js`: Google OAuth flow helpers
- `public/index.html`: app shell
- `public/auth.html`: registration/login/account page
- `public/styles/tokens.css`: semantic CSS variables (web token layer)
- `public/styles/app.css`: component styles using only semantic tokens
- `public/styles/auth.css`: auth/account page styles
- `public/scripts/app.js`: UI logic, upload flow, rendering
- `public/scripts/auth.js`: signup/login/google/account logic
- `public/scripts/common-auth.js`: lightweight account link state
- `design/tokens/tokens.json`: source-of-truth tokens for web + app

## Run

1. Copy env values:

```bash
cp .env.example .env
```

2. Set your API key in `.env`:

```env
MUSHROOM_API_KEY=your_real_key
```

Optional tuning:

```env
ENABLE_MIX_CHECK=true
MIX_CONFIDENCE_THRESHOLD=75
IDENTIFY_RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=20
AUTH_RATE_LIMIT_ENABLED=true
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=40
TRUST_PROXY=false
MAX_IMAGE_BYTES=8388608
APP_BASE_URL=https://amushroom.com
```

3. Install dependencies:

```bash
npm install
```

4. Start server:

```bash
npm start
```

5. Open [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Design Token Strategy

### Source of truth

Use `design/tokens/tokens.json` as your canonical token file.

### Web consumption

Web consumes mapped CSS variables from `public/styles/tokens.css`.

### App consumption

Your iOS/Android app should ingest `design/tokens/tokens.json` directly or through:

- GET `/api/design-tokens`

Then map these token groups in app UI layer:

- `color.brand`, `color.surface`, `color.text`, `color.state`, `color.border`
- `typography`
- `radius`
- `space`
- `shadow`

This keeps web and app visually consistent while allowing platform-specific components.

## Deployment

1. Deploy to Render/Railway/Fly.io.
   - Render blueprint included: `render.yaml`
2. Set env vars: `MUSHROOM_API_KEY`, `MUSHROOM_API_URL`, `MUSHROOM_API_LANGUAGE`, `ENABLE_MIX_CHECK`, `MIX_CONFIDENCE_THRESHOLD`, `IDENTIFY_RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_ENABLED`, `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`, `TRUST_PROXY`, `MAX_IMAGE_BYTES`, `APP_BASE_URL`, `DATABASE_PATH`, `SESSION_TTL_DAYS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `HOST`, `PORT`.
3. Point `amushroom.com` DNS to deployed service.
4. Enable HTTPS and uptime monitoring.

Health endpoints:

- `GET /healthz` (liveness)
- `GET /readyz` (readiness, includes API key check)

Auth and account endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `GET /api/user/uploads`

## Engineering Workflow

- Use feature branches and PRs only (no direct pushes to `main`).
- CI pipeline: `.github/workflows/ci.yml`
- PR template: `.github/pull_request_template.md`
- Code ownership: `.github/CODEOWNERS`

Local quality commands:

```bash
npm run check
npm test
```

Canonical backlog file:

- `/Users/varunvaid/Documents/projects/mushroom-identifier/backlog/BACKLOG.md`

## Safety

Results are best-effort visual predictions. Never consume wild mushrooms without expert confirmation.

## Security Baseline

- Session cookies are `HttpOnly` + `SameSite=Lax`, with `Secure` on HTTPS/production.
- Origin checks block cross-site POST requests for auth and identify APIs.
- Separate brute-force throttling protects authentication endpoints.
- Proxy headers are opt-in (`TRUST_PROXY=true`) to prevent client IP spoofing in direct-host deployments.
- Upload payloads are validated for encoding, MIME type, and per-image max byte size.
- Google OAuth return targets are sanitized to local paths to prevent open redirects.

## Mixed Species Detection

- The backend runs a per-photo consistency check to detect likely mixed-species uploads.
- If two photos strongly match different species, UI shows a warning in the summary.
- This uses per-image classification checks, not OCR.

## Legal and Commercial Baseline

Included public policy pages:

- `/terms.html`
- `/privacy.html`
- `/refund.html`

SEO and crawler baseline:

- `/robots.txt`
- `/sitemap.xml`

Important: legal pages are starter drafts and must be reviewed by qualified counsel before launch.
