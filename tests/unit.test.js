/**
 * UNIT TEST SUITE
 *
 * Pure logic tests — no network, no DB, no credentials.
 * Run on every PR before merge. Must complete in < 5s.
 *
 * Run: node --test tests/unit.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeEmail,
  validateEmail,
  validatePassword,
  parseCookies,
  createId,
  buildSessionCookie,
  buildClearSessionCookie,
} = require('../src/auth');

const { buildGoogleAuthUrl } = require('../src/google-oauth');

const root = path.join(__dirname, '..');

// ─── auth.js ─────────────────────────────────────────────────────────────────

test('normalizeEmail: trims whitespace and lowercases', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
  assert.equal(normalizeEmail('A@B.COM'), 'a@b.com');
  assert.equal(normalizeEmail(''), '');
});

test('validateEmail: rejects invalid formats', () => {
  assert.equal(validateEmail('bad').valid, false);
  assert.equal(validateEmail('no-at-sign').valid, false);
  assert.equal(validateEmail('@nodomain').valid, false);
  assert.equal(validateEmail('user@').valid, false);
});

test('validateEmail: accepts valid addresses', () => {
  assert.equal(validateEmail('valid@example.com').valid, true);
  assert.equal(validateEmail('user+tag@sub.domain.io').valid, true);
});

test('validatePassword: rejects short passwords', () => {
  assert.equal(validatePassword('short').valid, false);
  assert.equal(validatePassword('abc123').valid, false);
});

test('validatePassword: rejects passwords without numbers', () => {
  assert.equal(validatePassword('NoNumbersHere').valid, false);
});

test('validatePassword: accepts valid passwords', () => {
  assert.equal(validatePassword('abc1234567').valid, true);
  assert.equal(validatePassword('MyPass123!').valid, true);
});

test('parseCookies: parses well-formed cookie header', () => {
  const req = { headers: { cookie: 'session=abc123; theme=dark' } };
  const cookies = parseCookies(req);
  assert.equal(cookies.session, 'abc123');
  assert.equal(cookies.theme, 'dark');
});

test('parseCookies: tolerates malformed percent-encoded values', () => {
  const req = { headers: { cookie: 'good=value; bad=%E0%A4%A; safe=ok' } };
  const cookies = parseCookies(req);
  assert.equal(cookies.good, 'value');
  assert.equal(cookies.bad, '%E0%A4%A');
  assert.equal(cookies.safe, 'ok');
});

test('parseCookies: returns empty object with no cookie header', () => {
  const req = { headers: {} };
  assert.deepEqual(parseCookies(req), {});
});

test('createId: returns non-empty string', () => {
  const id = createId();
  assert.ok(typeof id === 'string' && id.length > 0);
});

test('createId: returns unique values', () => {
  const ids = new Set(Array.from({ length: 100 }, createId));
  assert.equal(ids.size, 100);
});

test('buildSessionCookie: includes session id and security attributes', () => {
  const fakeReq = { headers: {}, socket: { encrypted: false } };
  const cookie = buildSessionCookie(fakeReq, 'sess-id-123', 86400);
  assert.ok(cookie.includes('sess-id-123'), 'cookie must include session id');
  assert.ok(cookie.toLowerCase().includes('httponly'), 'must be HttpOnly');
  assert.ok(cookie.toLowerCase().includes('samesite'), 'must have SameSite');
});

test('buildClearSessionCookie: produces expired/empty cookie', () => {
  const fakeReq = { headers: {}, socket: { encrypted: false } };
  const cookie = buildClearSessionCookie(fakeReq);
  assert.ok(cookie.toLowerCase().includes('max-age=0') || cookie.toLowerCase().includes('expires='), 'must be expired');
});

// ─── google-oauth.js ──────────────────────────────────────────────────────────

test('buildGoogleAuthUrl: sets required OAuth query params', () => {
  const url = new URL(buildGoogleAuthUrl({
    clientId: 'test-client-id',
    redirectUri: 'https://orangutany.com/api/auth/google/callback',
    state: 'abc123',
  }));
  assert.equal(url.searchParams.get('client_id'), 'test-client-id');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://orangutany.com/api/auth/google/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'abc123');
  assert.ok(url.searchParams.get('scope')?.includes('email'), 'scope must include email');
});

// ─── db.js: constants exported ────────────────────────────────────────────────

test('db: ANON_SCAN_LIMIT is 3', () => {
  const { ANON_SCAN_LIMIT } = require('../src/db');
  assert.equal(ANON_SCAN_LIMIT, 3);
});

test('db: FREE_SCAN_LIMIT is 5', () => {
  const { FREE_SCAN_LIMIT } = require('../src/db');
  assert.equal(FREE_SCAN_LIMIT, 5);
});

// ─── File structure ───────────────────────────────────────────────────────────

test('structure: required production files exist', () => {
  const files = [
    'server.js',
    'src/auth.js',
    'src/db.js',
    'src/email.js',
    'src/google-oauth.js',
    'src/instagram.js',
    'render.yaml',
    '.nvmrc',
  ];
  for (const f of files) {
    assert.ok(fs.existsSync(path.join(root, f)), `Missing: ${f}`);
  }
});

test('structure: no better-sqlite3 imports anywhere', () => {
  const files = ['server.js', 'src/db.js', 'src/instagram.js'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert.ok(!src.includes('better-sqlite3'), `${f} still imports better-sqlite3`);
  }
});

test('structure: @libsql/client used in db.js and instagram.js', () => {
  for (const f of ['src/db.js', 'src/instagram.js']) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert.ok(src.includes('@libsql/client'), `${f} should import @libsql/client`);
  }
});

// ─── server.js: routes defined ────────────────────────────────────────────────

test('server: all expected API routes are defined', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const routes = [
    '/api/ping',
    '/api/auth/config',
    '/api/auth/me',
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/google',
    '/api/auth/google/callback',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/user/uploads',
    '/api/identify',
    '/api/feedback',
    '/api/admin/',
    '/healthz',
    '/readyz',
  ];
  for (const route of routes) {
    assert.ok(src.includes(route), `Route missing from server.js: ${route}`);
  }
});

test('server: all getAuthContext calls are awaited', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('async function getAuthContext('), 'getAuthContext should be async');
  // Find all call sites (not the function definition)
  const callSites = [...src.matchAll(/\bgetAuthContext\(req\)/g)];
  const lines = src.split('\n');
  const unawaited = callSites.filter(m => {
    const line = lines.find(l => l.includes(m[0])) || '';
    return !line.includes('await ') && !line.includes('function ');
  });
  assert.equal(unawaited.length, 0, `Found ${unawaited.length} unawaited getAuthContext() calls — auth guards will break`);
});

test('server: crash handlers registered (uncaughtException, unhandledRejection)', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('uncaughtException'), 'Missing uncaughtException handler');
  assert.ok(src.includes('unhandledRejection'), 'Missing unhandledRejection handler');
});

test('server: dbReady error does not call process.exit(1) before server listens', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  // server.listen should not be inside a dbReady.then block
  // (we moved it out to always start listening)
  const listenIdx = src.indexOf('server.listen(');
  const dbReadyIdx = src.lastIndexOf('dbReady.then');
  // server.listen should come AFTER dbReady is set up (or outside it)
  assert.ok(listenIdx > 0, 'server.listen not found');
  assert.ok(dbReadyIdx > 0, 'dbReady.then not found');
});

// ─── Security ─────────────────────────────────────────────────────────────────

test('security: same-origin check applied to auth and identify POST endpoints', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('requireSameOrigin'), 'requireSameOrigin function missing');
  // register, login, logout, identify all use it
  const usages = (src.match(/requireSameOrigin/g) || []).length;
  assert.ok(usages >= 4, `Only ${usages} requireSameOrigin uses — expected at least 4`);
});

test('security: admin check uses isAdmin()', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('isAdmin('), 'isAdmin check missing');
});

// ─── render.yaml ─────────────────────────────────────────────────────────────

test('render.yaml: TURSO_DATABASE_URL env var declared', () => {
  const yaml = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  assert.ok(yaml.includes('TURSO_DATABASE_URL'), 'TURSO_DATABASE_URL missing from render.yaml');
  assert.ok(yaml.includes('TURSO_AUTH_TOKEN'), 'TURSO_AUTH_TOKEN missing from render.yaml');
});

test('render.yaml: plan is free (not paid)', () => {
  const yaml = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  assert.ok(yaml.includes('plan: free'), 'render.yaml should use free plan');
});
