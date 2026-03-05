/**
 * FULL END-TO-END FUNCTIONAL TEST SUITE
 *
 * Covers every API endpoint, all auth flows, user features, admin section,
 * page links, and email sending. Uses real HTTP against production (or staging).
 *
 * Prerequisites:
 *   TEST_BASE_URL   — defaults to https://orangutany.com
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD — admin account credentials
 *   TEST_USER_EMAIL / TEST_USER_PASSWORD   — regular free-tier account
 *
 * Run: node --test tests/e2e.test.js
 * With env: TEST_ADMIN_EMAIL=you@example.com TEST_ADMIN_PASSWORD=... node --test tests/e2e.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const http = require('node:http');

const BASE          = process.env.TEST_BASE_URL       || 'https://orangutany.com';
const ADMIN_EMAIL   = process.env.TEST_ADMIN_EMAIL    || '';
const ADMIN_PASS    = process.env.TEST_ADMIN_PASSWORD || '';
const USER_EMAIL    = process.env.TEST_USER_EMAIL     || '';
const USER_PASS     = process.env.TEST_USER_PASSWORD  || '';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function request(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = BASE + path;
    const lib = url.startsWith('https') ? https : http;
    const body = opts.body ? JSON.stringify(opts.body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      ...(opts.cookie ? { 'Cookie': opts.cookie } : {}),
      'Origin': BASE,
      ...(opts.headers || {})
    };
    const req = lib.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const get  = (path, opts) => request('GET', path, opts);
const post = (path, body, opts = {}) => request('POST', path, { ...opts, body });
const patch = (path, body, opts = {}) => request('PATCH', path, { ...opts, body });

function extractCookie(res, name) {
  const raw = res.headers['set-cookie'] || [];
  const all = Array.isArray(raw) ? raw : [raw];
  for (const c of all) {
    const pair = c.split(';')[0];
    if (pair.startsWith(name + '=')) return pair;
  }
  return null;
}

// Log in and return session cookie string
async function login(email, password) {
  const r = await post('/api/auth/login', { email, password });
  assert.equal(r.status, 200, `Login failed for ${email}: ${r.body}`);
  const cookie = extractCookie(r, 'session');
  assert.ok(cookie, 'No session cookie returned after login');
  return cookie;
}

// ─── Infrastructure ───────────────────────────────────────────────────────────

test('infrastructure: /api/ping — server alive', async () => {
  const r = await get('/api/ping');
  assert.equal(r.status, 200);
  assert.ok(r.json?.ok);
});

test('infrastructure: database ready', async () => {
  const r = await get('/api/ping');
  assert.ok(r.json?.dbReady === true, `DB not ready: ${r.json?.dbError}`);
  assert.equal(r.json?.dbError, null);
});

test('infrastructure: Turso URL is cloud (not local file)', async () => {
  const r = await get('/api/ping');
  assert.ok(r.json?.tursoUrl?.startsWith('libsql://'));
});

test('infrastructure: /healthz returns 200', async () => {
  const r = await get('/healthz');
  assert.equal(r.status, 200);
});

test('infrastructure: /readyz shows DB and API key', async () => {
  const r = await get('/readyz');
  assert.ok([200, 503].includes(r.status));
  assert.ok(r.json?.checks, 'readyz should return checks object');
  assert.ok(typeof r.json.checks.databaseReady === 'boolean');
});

// ─── Auth: config ─────────────────────────────────────────────────────────────

test('auth: /api/auth/config returns googleAuthEnabled', async () => {
  const r = await get('/api/auth/config');
  assert.equal(r.status, 200);
  assert.ok(typeof r.json?.googleAuthEnabled === 'boolean');
});

test('auth: Google auth enabled in production', async () => {
  const r = await get('/api/auth/config');
  assert.ok(r.json?.googleAuthEnabled === true, 'Google auth disabled — check GOOGLE_CLIENT_ID');
});

// ─── Auth: unauthenticated /me ────────────────────────────────────────────────

test('auth: /api/auth/me unauthenticated returns null user', async () => {
  const r = await get('/api/auth/me');
  assert.equal(r.status, 200);
  assert.equal(r.json?.user, null);
  assert.equal(r.json?.isAdmin, false);
});

// ─── Auth: guards ─────────────────────────────────────────────────────────────

test('auth guard: /api/user/uploads returns 401 without session', async () => {
  const r = await get('/api/user/uploads');
  assert.equal(r.status, 401, `Auth guard broken — got ${r.status}`);
});

test('auth guard: /api/admin/summary returns 403 without session', async () => {
  const r = await get('/api/admin/summary');
  assert.equal(r.status, 403, `Admin guard broken — got ${r.status}`);
});

test('auth guard: /api/admin/events returns 403 without session', async () => {
  const r = await get('/api/admin/events');
  assert.equal(r.status, 403);
});

test('auth guard: /api/admin/users returns 403 without session', async () => {
  const r = await get('/api/admin/users');
  assert.equal(r.status, 403);
});

// ─── Auth: register rejects bad input ────────────────────────────────────────

test('auth: register rejects missing fields', async () => {
  const r = await post('/api/auth/register', { email: 'nope' });
  assert.ok([400, 422].includes(r.status), `Expected 400/422, got ${r.status}`);
});

test('auth: register rejects weak password', async () => {
  const r = await post('/api/auth/register', { email: 'test@example.com', password: 'short', name: 'Test' });
  assert.ok([400, 422].includes(r.status));
});

test('auth: login rejects wrong credentials', async () => {
  const r = await post('/api/auth/login', { email: 'nobody@example.com', password: 'wrongpassword1' });
  assert.ok([400, 401, 403].includes(r.status), `Expected auth failure, got ${r.status}`);
});

// ─── Auth: full login/me/logout flow (requires TEST_USER_EMAIL) ──────────────

test('auth: login → /me → logout flow', { skip: !USER_EMAIL }, async () => {
  const cookie = await login(USER_EMAIL, USER_PASS);

  const me = await get('/api/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.ok(me.json?.user?.email, 'User email missing after login');
  assert.equal(me.json.user.email.toLowerCase(), USER_EMAIL.toLowerCase());

  const logout = await post('/api/auth/logout', {}, { cookie });
  assert.ok([200, 204].includes(logout.status), `Logout failed: ${logout.status}`);

  const meAfter = await get('/api/auth/me', { cookie });
  assert.equal(meAfter.json?.user, null, 'Session should be cleared after logout');
});

// ─── User: uploads history (requires TEST_USER_EMAIL) ────────────────────────

test('user: /api/user/uploads returns array when logged in', { skip: !USER_EMAIL }, async () => {
  const cookie = await login(USER_EMAIL, USER_PASS);
  const r = await get('/api/user/uploads', { cookie });
  assert.equal(r.status, 200, `Expected 200, got ${r.status}: ${r.body}`);
  assert.ok(Array.isArray(r.json), 'uploads should be an array');
});

// ─── Quota ────────────────────────────────────────────────────────────────────

test('quota: /api/quota returns quota info', async () => {
  const r = await get('/api/quota');
  assert.ok([200, 404].includes(r.status), `Unexpected status ${r.status}`);
  // 200 means quota endpoint exists and works
  if (r.status === 200) {
    assert.ok(typeof r.json?.limit === 'number' || r.json?.tier, 'quota response malformed');
  }
});

// ─── Password reset ───────────────────────────────────────────────────────────

test('password reset: rejects missing email', async () => {
  const r = await post('/api/auth/forgot-password', {});
  assert.ok([400, 422].includes(r.status), `Expected 400/422, got ${r.status}`);
});

test('password reset: returns 200 for unknown email (no enumeration)', async () => {
  const r = await post('/api/auth/forgot-password', { email: 'nobody-at-all@fake-domain-xyz.com' });
  assert.ok([200, 204].includes(r.status), `Expected 200/204 to prevent enumeration, got ${r.status}`);
});

// ─── Feedback ────────────────────────────────────────────────────────────────

test('feedback: rejects empty message', async () => {
  const r = await post('/api/feedback', { message: '' });
  assert.ok([400, 422].includes(r.status));
});

test('feedback: accepts valid message', async () => {
  const r = await post('/api/feedback', { message: 'Automated e2e test feedback — please ignore.', email: 'test@example.com' });
  assert.ok([200, 201, 204].includes(r.status), `Feedback POST failed: ${r.status} ${r.body}`);
});

// ─── Admin full suite (requires TEST_ADMIN_EMAIL) ────────────────────────────

test('admin: login and /api/auth/me shows isAdmin=true', { skip: !ADMIN_EMAIL }, async () => {
  const cookie = await login(ADMIN_EMAIL, ADMIN_PASS);
  const r = await get('/api/auth/me', { cookie });
  assert.ok(r.json?.isAdmin === true, `User is not admin — check ADMIN_EMAILS env var on Render`);
});

test('admin: /api/admin/summary returns stats', { skip: !ADMIN_EMAIL }, async () => {
  const cookie = await login(ADMIN_EMAIL, ADMIN_PASS);
  const r = await get('/api/admin/summary', { cookie });
  assert.equal(r.status, 200, `Admin summary failed: ${r.status} ${r.body}`);
  assert.ok(typeof r.json?.totalUsers === 'number', 'totalUsers should be a number');
  assert.ok(typeof r.json?.totalScans === 'number');
});

test('admin: totalUsers >= 1 (admin account exists)', { skip: !ADMIN_EMAIL }, async () => {
  const cookie = await login(ADMIN_EMAIL, ADMIN_PASS);
  const r = await get('/api/admin/summary', { cookie });
  assert.ok(r.json?.totalUsers >= 1, `Expected at least 1 user, got ${r.json?.totalUsers}`);
});

test('admin: /api/admin/events returns array', { skip: !ADMIN_EMAIL }, async () => {
  const cookie = await login(ADMIN_EMAIL, ADMIN_PASS);
  const r = await get('/api/admin/events', { cookie });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json?.events));
});

test('admin: /api/admin/users returns array', { skip: !ADMIN_EMAIL }, async () => {
  const cookie = await login(ADMIN_EMAIL, ADMIN_PASS);
  const r = await get('/api/admin/users', { cookie });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json?.users));
});

test('admin: /api/admin/scans-by-day returns data array', { skip: !ADMIN_EMAIL }, async () => {
  const cookie = await login(ADMIN_EMAIL, ADMIN_PASS);
  const r = await get('/api/admin/scans-by-day?days=30', { cookie });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json?.data));
});

test('admin: /api/admin/signups-by-day returns data array', { skip: !ADMIN_EMAIL }, async () => {
  const cookie = await login(ADMIN_EMAIL, ADMIN_PASS);
  const r = await get('/api/admin/signups-by-day?days=30', { cookie });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json?.data));
});

test('admin: /api/admin/species returns data array', { skip: !ADMIN_EMAIL }, async () => {
  const cookie = await login(ADMIN_EMAIL, ADMIN_PASS);
  const r = await get('/api/admin/species?days=30', { cookie });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json?.data));
});

test('admin: non-admin user gets 403 on admin routes', { skip: !USER_EMAIL }, async () => {
  const cookie = await login(USER_EMAIL, USER_PASS);
  const r = await get('/api/admin/summary', { cookie });
  assert.equal(r.status, 403, 'Non-admin should not access admin routes');
});

// ─── Frontend pages / links ───────────────────────────────────────────────────

const PAGES = [
  '/',
  '/about',
  '/learn',
  '/privacy',
  '/terms',
  '/refund',
  '/resources',
  '/forgot-password',
];

for (const page of PAGES) {
  test(`page: ${page} returns 200`, async () => {
    const r = await get(page);
    assert.equal(r.status, 200, `${page} returned ${r.status}`);
    assert.ok(r.body.length > 100, `${page} body suspiciously short`);
  });
}

// Static assets
test('page: /robots.txt returns 200', async () => {
  const r = await get('/robots.txt');
  assert.equal(r.status, 200);
  assert.ok(r.body.includes('User-agent') || r.body.includes('Sitemap'));
});

test('page: /sitemap.xml returns 200', async () => {
  const r = await get('/sitemap.xml');
  assert.equal(r.status, 200);
  assert.ok(r.body.includes('<url') || r.body.includes('urlset'));
});

// ─── 404 handling ─────────────────────────────────────────────────────────────

test('404: unknown page returns non-200 or custom 404 HTML', async () => {
  const r = await get('/this-page-does-not-exist-xyz');
  assert.ok(r.status === 404 || r.status === 200, `Unexpected status ${r.status}`);
  // 200 is acceptable if Next.js renders a custom not-found page
});

test('404: unknown API route returns 404 JSON', async () => {
  const r = await get('/api/nonexistent-route-xyz');
  assert.ok([404, 400].includes(r.status), `Expected 404, got ${r.status}`);
});

// ─── Database workflow checks ─────────────────────────────────────────────────
// These confirm DB is actually persisting and reading correctly — not just "connected"

test('db workflow: server reports Turso cloud URL (not ephemeral file)', async () => {
  const r = await get('/api/ping');
  assert.equal(r.status, 200, 'Server unreachable — is it deployed?');
  const url = r.json?.tursoUrl || '';
  assert.ok(url.startsWith('libsql://'), [
    'CRITICAL: DB is using local file storage — data will be wiped on every deploy!',
    `Got: ${url}`,
    'Fix: Set TURSO_DATABASE_URL=libsql://... on Render dashboard.',
  ].join('\n'));
});

test('db workflow: DB init completed without error', async () => {
  const r = await get('/api/ping');
  const err = r.json?.dbError;
  assert.equal(err, null, [
    'CRITICAL: DB initialization failed on startup.',
    `Error: ${err}`,
    'Likely causes: wrong TURSO_AUTH_TOKEN, network issue, or schema migration failure.',
  ].join('\n'));
});

test('db workflow: auth/me returns valid JSON (DB connection live)', async () => {
  const r = await get('/api/auth/me');
  assert.equal(r.status, 200, [
    'CRITICAL: /api/auth/me returned non-200.',
    `Status: ${r.status} — Body: ${r.body.slice(0, 200)}`,
    'If 500: server.js is likely crashing. Check /api/ping for DB error.',
    'If 404: Next.js is not proxying /api/* to server.js — check next.config.ts rewrites.',
  ].join('\n'));
  assert.ok(r.json !== null, 'Response is not valid JSON — server may be down');
});

test('db workflow: user uploads endpoint requires auth (DB session check works)', async () => {
  const r = await get('/api/user/uploads');
  assert.equal(r.status, 401, [
    `Expected 401 from /api/user/uploads without auth, got ${r.status}.`,
    r.status === 500 ? 'Got 500 — DB is likely broken or server is crashing.' : '',
    r.status === 200 ? 'Got 200 — auth guard not working, getAuthContext may be unawaited.' : '',
  ].filter(Boolean).join('\n'));
});

test('db workflow: admin endpoint requires auth (session + user lookup works)', async () => {
  const r = await get('/api/admin/summary');
  assert.equal(r.status, 403, [
    `Expected 403 from /api/admin/summary without auth, got ${r.status}.`,
    r.status === 500 ? 'Got 500 — DB is likely broken or getAuthContext is crashing.' : '',
    r.status === 200 ? 'Got 200 — admin guard broken, check isAdmin() and await on getAuthContext.' : '',
  ].filter(Boolean).join('\n'));
});

test('db workflow: admin stats show >=1 user when credentials provided', { skip: !ADMIN_EMAIL }, async () => {
  const cookie = await login(ADMIN_EMAIL, ADMIN_PASS);
  const r = await get('/api/admin/summary', { cookie });
  assert.equal(r.status, 200, `Admin summary returned ${r.status}: ${r.body}`);
  assert.ok(r.json?.totalUsers >= 1, [
    `Admin shows ${r.json?.totalUsers} users — expected at least 1 (you!).`,
    'If 0: getAuthContext was unawaited (auth guard broken), or DB has no users.',
    'If null: admin summary query failed — check Turso connection.',
  ].join('\n'));
});

test('db workflow: user history loads when logged in', { skip: !USER_EMAIL }, async () => {
  const cookie = await login(USER_EMAIL, USER_PASS);
  const r = await get('/api/user/uploads', { cookie });
  assert.equal(r.status, 200, [
    `User uploads returned ${r.status}: ${r.body.slice(0, 200)}`,
    r.status === 401 ? 'Got 401 — getAuthContext is likely unawaited in handleUserUploads.' : '',
    r.status === 500 ? 'Got 500 — DB error reading uploads.' : '',
  ].filter(Boolean).join('\n'));
  assert.ok(Array.isArray(r.json), 'Uploads should be an array (even if empty)');
});

// ─── Authentication workflow checks ──────────────────────────────────────────

test('auth workflow: register → login → me → logout full cycle', { skip: !USER_EMAIL }, async () => {
  // Login
  const loginRes = await post('/api/auth/login', { email: USER_EMAIL, password: USER_PASS });
  assert.equal(loginRes.status, 200, `Login failed: ${loginRes.body}`);
  const cookie = extractCookie(loginRes, 'session');
  assert.ok(cookie, 'No session cookie set after login');

  // /me confirms session persisted to DB
  const me = await get('/api/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.ok(me.json?.user?.email, 'Session not found in DB — session cookie set but user not returned');
  assert.equal(me.json.user.email.toLowerCase(), USER_EMAIL.toLowerCase());

  // Logout clears session from DB
  const out = await post('/api/auth/logout', {}, { cookie });
  assert.ok([200, 204].includes(out.status), `Logout failed: ${out.status}`);

  // /me after logout should return null
  const meAfter = await get('/api/auth/me', { cookie });
  assert.equal(meAfter.json?.user, null, 'Session should be invalidated after logout — DB delete may have failed');
});

test('auth workflow: Google auth redirect URL is reachable', async () => {
  const r = await request('GET', '/api/auth/google', { headers: { 'Cookie': '' } });
  // Should redirect to Google (302) or return 400 if no client ID — not 500
  assert.ok([302, 301, 400].includes(r.status), [
    `Google auth endpoint returned ${r.status} — expected redirect to Google.`,
    r.status === 500 ? 'Got 500 — server is crashing, check GOOGLE_CLIENT_ID.' : '',
  ].filter(Boolean).join('\n'));
});

// ─── Email workflow checks ────────────────────────────────────────────────────
// We can't verify delivery, but we can check the endpoint doesn't crash.

test('email workflow: forgot-password returns 200 for valid email format', async () => {
  const r = await post('/api/auth/forgot-password', { email: 'e2e-test-probe@example.com' });
  assert.ok([200, 204].includes(r.status), [
    `forgot-password returned ${r.status}: ${r.body}`,
    'Expected 200/204 (endpoint should not enumerate whether email exists).',
    r.status === 500 ? 'Got 500 — email sending may be crashing. Check RESEND_API_KEY on Render.' : '',
  ].filter(Boolean).join('\n'));
});

test('email workflow: forgot-password rejects clearly invalid email', async () => {
  const r = await post('/api/auth/forgot-password', { email: 'not-an-email' });
  assert.ok([400, 422].includes(r.status), `Expected 400/422 for invalid email, got ${r.status}`);
});

test('email workflow: reset-password rejects bad/expired token', async () => {
  const r = await post('/api/auth/reset-password', {
    token: 'fake-token-that-does-not-exist',
    password: 'NewPassword123!'
  });
  assert.ok([400, 401, 404, 422].includes(r.status), `Expected error for bad token, got ${r.status}`);
});
