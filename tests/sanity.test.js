/**
 * SANITY TEST SUITE
 *
 * Quick go/no-go checks — run after every deploy or major change.
 * Hits live production (orangutany.com) and verifies core infrastructure
 * responds correctly. No credentials needed. Completes in < 30s.
 *
 * Run: node --test tests/sanity.test.js
 * Against staging: TEST_BASE_URL=https://... node --test tests/sanity.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const http = require('node:http');

const BASE = process.env.TEST_BASE_URL || 'https://orangutany.com';

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function get(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = BASE + path;
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'GET', headers: opts.headers || {} }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, body, json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── 1. Backend server alive ──────────────────────────────────────────────────

test('backend /api/ping responds 200', async () => {
  const r = await get('/api/ping');
  assert.equal(r.status, 200, `Expected 200, got ${r.status}: ${r.body}`);
  assert.ok(r.json?.ok === true, 'ping.ok should be true');
});

test('database is connected and ready', async () => {
  const r = await get('/api/ping');
  assert.equal(r.status, 200);
  assert.ok(r.json?.dbReady === true, `DB not ready — error: ${r.json?.dbError}`);
  assert.equal(r.json?.dbError, null, `DB init error: ${r.json?.dbError}`);
});

test('Turso URL is configured (not local file fallback)', async () => {
  const r = await get('/api/ping');
  assert.ok(r.json?.tursoUrl?.startsWith('libsql://'), `Expected libsql:// URL, got: ${r.json?.tursoUrl}`);
});

// ─── 2. Auth endpoints ────────────────────────────────────────────────────────

test('/api/auth/config responds with googleAuthEnabled boolean', async () => {
  const r = await get('/api/auth/config');
  assert.equal(r.status, 200, `Expected 200, got ${r.status}`);
  assert.ok(typeof r.json?.googleAuthEnabled === 'boolean', 'googleAuthEnabled should be boolean');
});

test('Google auth is enabled in production', async () => {
  const r = await get('/api/auth/config');
  assert.equal(r.json?.googleAuthEnabled, true, 'Google auth not enabled — check GOOGLE_CLIENT_ID on Render');
});

test('/api/auth/me returns 200 for unauthenticated request', async () => {
  const r = await get('/api/auth/me');
  assert.equal(r.status, 200, `Expected 200, got ${r.status}`);
  assert.equal(r.json?.user, null, 'Unauthenticated user should be null');
  assert.equal(r.json?.isAdmin, false);
});

// ─── 3. Auth guards ───────────────────────────────────────────────────────────

test('/api/user/uploads returns 401 without a session', async () => {
  const r = await get('/api/user/uploads');
  assert.equal(r.status, 401, `Expected 401 — auth guard may be broken (await missing?), got ${r.status}`);
});

test('/api/admin/summary returns 403 without a session', async () => {
  const r = await get('/api/admin/summary');
  assert.equal(r.status, 403, `Expected 403 — admin guard may be broken, got ${r.status}`);
});

// ─── 4. Frontend pages ───────────────────────────────────────────────────────

test('homepage returns 200', async () => {
  const r = await get('/');
  assert.equal(r.status, 200, `Homepage returned ${r.status}`);
  assert.ok(r.body.includes('<html') || r.body.includes('<!DOCTYPE'), 'Body should be HTML');
});

test('/learn returns 200', async () => {
  const r = await get('/learn');
  assert.equal(r.status, 200, `/learn returned ${r.status}`);
});

test('/about returns 200', async () => {
  const r = await get('/about');
  assert.equal(r.status, 200, `/about returned ${r.status}`);
});

// ─── 5. Health ────────────────────────────────────────────────────────────────

test('/healthz returns 200', async () => {
  const r = await get('/healthz');
  assert.equal(r.status, 200, `/healthz returned ${r.status}`);
});
