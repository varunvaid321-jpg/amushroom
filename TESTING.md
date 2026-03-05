# Orangutany — Test Suites

## Suites

| Suite | File | When to run | Credentials needed |
|-------|------|-------------|-------------------|
| **Unit** | `tests/unit.test.js` | Every PR, pre-commit | None |
| **Sanity** | `tests/sanity.test.js` | Every deploy / after major change | None |
| **Functional** | `tests/e2e.test.js` | Before releases, after infra changes | `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` |
| **UI** | `tests/ui.test.js` | After UI changes, before releases | None (admin/user creds for full coverage) |

---

## Running

```bash
# Unit tests (fast, no network, every PR)
node --test tests/unit.test.js

# Sanity check (hits production, ~30s, every deploy)
node --test tests/sanity.test.js

# Full functional suite (requires credentials, run when needed)
TEST_ADMIN_EMAIL=your@email.com \
TEST_ADMIN_PASSWORD=yourpassword \
TEST_USER_EMAIL=user@email.com \
TEST_USER_PASSWORD=userpassword \
node --test tests/e2e.test.js

# All at once via npm
npm test                      # runs unit only (CI default)
npm run test:sanity           # sanity check against production
npm run test:e2e              # full functional (set env vars first)
npm run test:ui               # UI browser tests (Playwright, headless Chromium)
npm run test:all              # unit + sanity + functional + UI
```

Against a local or staging server:
```bash
TEST_BASE_URL=http://localhost:3001 node --test tests/sanity.test.js
```

---

## What each suite covers

### Unit (`tests/unit.test.js`) — run on every PR
- `auth.js`: normalizeEmail, validateEmail, validatePassword, parseCookies, createId, session cookies
- `google-oauth.js`: buildGoogleAuthUrl param validation
- `db.js`: quota constants (ANON=3, FREE=5)
- **server.js structural checks**: all routes defined, no unawaited `getAuthContext`, crash handlers present, no `better-sqlite3` imports
- `render.yaml`: Turso env vars declared, plan is free

### Sanity (`tests/sanity.test.js`) — run on every deploy
- Backend alive: `/api/ping` returns 200, DB connected, Turso URL is cloud
- Auth endpoints: `/api/auth/config`, `/api/auth/me`
- Auth guards: `/api/user/uploads` → 401, `/api/admin/summary` → 403
- Google auth enabled
- Core pages load: `/`, `/learn`, `/about`
- `/healthz` responds

### UI (`tests/ui.test.js`) — run after UI changes
- Real browser (headless Chromium via Playwright)
- Screenshots saved to `tests/screenshots/` — FAIL-*.png on failures
- Homepage: title, "Identify wild mushrooms from photos" headline, upload area, Analyze Photos button disabled, "X of 3 free scans remaining" quota
- Auth modal: Log in / Sign Up Free buttons, Google sign-in button, wrong-password error
- Pages: forgot-password, about, learn (≥3 articles), privacy, terms
- Mobile (390px): no horizontal overflow, Analyze button tappable (≥36px height)
- Admin dashboard: stat cards visible, totalUsers ≥ 1 (requires credentials)
- 404: not blank, stays on-site
- Link integrity: all internal links return < 400

### Functional (`tests/e2e.test.js`) — run when needed
Everything in Sanity plus:
- Full login → /me → logout cycle
- Register rejects bad input
- User upload history loads
- Admin: all stats endpoints, non-admin blocked
- All pages: `/privacy`, `/terms`, `/refund`, `/resources`, `/forgot-password`, `/robots.txt`, `/sitemap.xml`
- **DB workflow checks**: verifies Turso cloud URL, DB init success, session persistence, history loading
- **Auth workflow**: cookie set, session stored in DB, logout clears session
- **Email workflow**: forgot-password endpoint doesn't crash, rejects invalid emails, reset-password rejects bad tokens

---

## When DB or auth is broken — diagnostic steps

Run sanity first:
```bash
node --test tests/sanity.test.js
```

Then check `/api/ping` directly:
```bash
curl https://orangutany.com/api/ping
```

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `dbReady: false` | DB init failed at startup | Check `dbError` field, verify `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` on Render |
| `tursoUrl` starts with `file:` | `TURSO_DATABASE_URL` not set on Render | Set env var on Render dashboard |
| `/api/auth/me` returns 500 | server.js crashing | Check `/api/ping` first, then Render logs |
| Admin shows 0 users | `getAuthContext` missing `await` | Search server.js for unawaited `getAuthContext(` calls |
| History empty (401) | `getAuthContext` missing `await` in upload handler | Same as above |
| History empty (200, [] array) | DB is new/empty — normal after migration | Expected; data accumulates as users scan |

---

## Database backup

Turso free tier includes:
- Point-in-time recovery via Turso dashboard (app.turso.tech)
- The DB is `orangutany` under account `varunvaid321-jpg`
- URL: `libsql://orangutany-varunvaid321-jpg.aws-us-east-1.turso.io`

To dump a manual backup locally:
```bash
turso db shell orangutany ".dump" > backup-$(date +%Y%m%d).sql
```

Run this before any major migration or schema change.

---

## Checklist before pushing to main

- [ ] `npm run check` passes (syntax validation)
- [ ] `node --test tests/unit.test.js` passes
- [ ] `node --test tests/sanity.test.js` passes (after deploy)
- [ ] `node --test tests/ui.test.js` passes (after UI changes)
- [ ] No `better-sqlite3` imports introduced
- [ ] All `getAuthContext()` calls have `await`
- [ ] `render.yaml` plan still `free`
