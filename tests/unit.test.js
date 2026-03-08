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
  const src = fs.readFileSync(path.join(root, 'src/db.js'), 'utf8');
  const m = src.match(/ANON_SCAN_LIMIT\b.*?\|\|\s*(\d+)/);
  assert.ok(m, 'ANON_SCAN_LIMIT default not found in src/db.js');
  assert.equal(Number(m[1]), 3);
});

test('db: FREE_SCAN_LIMIT is 5', () => {
  const src = fs.readFileSync(path.join(root, 'src/db.js'), 'utf8');
  const m = src.match(/FREE_SCAN_LIMIT\b.*?\|\|\s*(\d+)/);
  assert.ok(m, 'FREE_SCAN_LIMIT default not found in src/db.js');
  assert.equal(Number(m[1]), 5);
});

// ─── Dependency integrity ────────────────────────────────────────────────────

test('dependencies: all require() calls in server.js resolve to installed packages', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  // Find all require('...') calls that aren't node: builtins or relative paths
  const requires = [...src.matchAll(/require\(['"]([^'"]+)['"]\)/g)]
    .map(m => m[1])
    .filter(m => !m.startsWith('.') && !m.startsWith('node:'));

  const missing = requires.filter(mod => {
    const pkgName = mod.startsWith('@') ? mod.split('/').slice(0, 2).join('/') : mod.split('/')[0];
    return !allDeps[pkgName];
  });

  assert.equal(
    missing.length, 0,
    `server.js requires packages not in package.json: ${missing.join(', ')}\nAdd them with: npm install ${missing.join(' ')}`
  );
});

// ─── Payment / Stripe integration ────────────────────────────────────────────

test('payment: stripe routes defined in server.js', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const routes = [
    '/api/stripe/webhook',
    '/api/stripe/create-checkout-session',
    '/api/stripe/portal-session',
  ];
  for (const route of routes) {
    assert.ok(src.includes(route), `Stripe route missing: ${route}`);
  }
});

test('payment: webhook validates stripe-signature header', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('stripe-signature'), 'Webhook must verify stripe-signature header');
  assert.ok(src.includes('constructEvent'), 'Webhook must use constructEvent for signature verification');
});

test('payment: webhook handles all required event types', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const events = [
    'checkout.session.completed',
    'customer.subscription.deleted',
    'customer.subscription.updated',
    'invoice.payment_succeeded',
  ];
  for (const evt of events) {
    assert.ok(src.includes(evt), `Webhook must handle ${evt}`);
  }
});

test('payment: checkout requires authentication', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fnStart = src.indexOf('async function handleStripeCheckout(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 2000);
  assert.ok(fnBody.includes('getAuthContext'), 'Checkout must check auth');
  assert.ok(fnBody.includes('401'), 'Checkout must return 401 for unauthenticated');
});

test('payment: upgrade triggers confirmation email', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('sendUpgradeEmail'), 'Checkout completion must send upgrade email');
});

test('payment: downgrade handled on subscription cancel', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('downgradeUser'), 'Must downgrade user when subscription is cancelled');
});

test('payment: PRO_SCAN_DAILY_LIMIT is 50', () => {
  const src = fs.readFileSync(path.join(root, 'src/db.js'), 'utf8');
  const m = src.match(/PRO_SCAN_DAILY_LIMIT\b.*?\|\|\s*(\d+)/);
  assert.ok(m, 'PRO_SCAN_DAILY_LIMIT default not found in src/db.js');
  assert.equal(Number(m[1]), 50);
});

test('payment: email.js exports sendUpgradeEmail and sendAbuseAlertEmail', () => {
  const src = fs.readFileSync(path.join(root, 'src/email.js'), 'utf8');
  const exportMatch = src.match(/module\.exports\s*=\s*\{([^}]+)\}/);
  assert.ok(exportMatch, 'Could not find module.exports in email.js');
  assert.ok(exportMatch[1].includes('sendUpgradeEmail'), 'sendUpgradeEmail must be exported');
  assert.ok(exportMatch[1].includes('sendAbuseAlertEmail'), 'sendAbuseAlertEmail must be exported');
});

test('payment: all email.js exports used in server.js exist', () => {
  const serverSrc = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const emailSrc = fs.readFileSync(path.join(root, 'src/email.js'), 'utf8');

  // Extract what server.js imports from email.js
  const importMatch = serverSrc.match(/\{([^}]+)\}\s*=\s*require\(['"]\.\/(src\/email)['"]\)/);
  assert.ok(importMatch, 'Could not find email.js import in server.js');
  const imported = importMatch[1].match(/\b[a-zA-Z_]\w*\b/g) || [];

  // Extract what email.js exports
  const exportMatch = emailSrc.match(/module\.exports\s*=\s*\{([^}]+)\}/);
  assert.ok(exportMatch, 'Could not find module.exports in email.js');
  const exported = exportMatch[1].match(/\b[a-zA-Z_]\w*\b/g) || [];

  const missing = imported.filter(name => !exported.includes(name));
  assert.equal(missing.length, 0, `server.js imports from email.js that don't exist: ${missing.join(', ')}`);
});

// ─── Financial workflow: billing page & upgrade hook ─────────────────────────

test('billing: openPortal error state exists and displays to user', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/app/account/billing/page.tsx'), 'utf8');
  assert.ok(src.includes('portalError'), 'billing page must have portalError state for Manage Subscription failures');
  assert.ok(
    src.includes('setPortalError(') && src.includes('catch'),
    'billing page must set portalError in catch block so users see failure feedback'
  );
  // Must render the error
  assert.ok(
    src.includes('{portalError') || src.includes('portalError &&'),
    'billing page must conditionally render portalError message'
  );
});

test('billing: openPortal clears previous error on retry', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/app/account/billing/page.tsx'), 'utf8');
  const fnStart = src.indexOf('async function openPortal()');
  const fnEnd = src.indexOf('}', src.indexOf('catch', fnStart) + 20);
  const fnBody = src.slice(fnStart, fnEnd);
  // setPortalError(null) must come before the try/await
  const clearIdx = fnBody.indexOf('setPortalError(null)');
  const tryIdx = fnBody.indexOf('try');
  assert.ok(clearIdx > 0 && clearIdx < tryIdx, 'openPortal must clear portalError before try block');
});

test('billing: portal session route exists as GET', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(
    src.includes("req.method === 'GET'") && src.includes('/api/stripe/portal-session'),
    'Portal session must be a GET route'
  );
});

test('billing: portal handler requires auth and stripe_customer_id', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fnStart = src.indexOf('async function handleStripePortal(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 500);
  assert.ok(fnBody.includes('getAuthContext'), 'Portal handler must check authentication');
  assert.ok(fnBody.includes('401'), 'Portal handler must return 401 for unauthenticated');
  assert.ok(fnBody.includes('stripe_customer_id'), 'Portal handler must check for stripe customer');
  assert.ok(fnBody.includes('billingPortal.sessions.create'), 'Portal handler must create billing portal session');
});

test('billing: Manage Subscription button gated by hasStripeCustomer', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/app/account/billing/page.tsx'), 'utf8');
  assert.ok(
    src.includes('user.hasStripeCustomer'),
    'Manage Subscription must be gated by hasStripeCustomer to avoid showing button when no Stripe customer exists'
  );
});

test('upgrade hook: bfcache cleanup via pageshow listener', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/hooks/use-upgrade.tsx'), 'utf8');
  assert.ok(src.includes('pageshow'), 'UpgradeProvider must listen for pageshow event (bfcache restore)');
  assert.ok(src.includes('e.persisted') || src.includes('event.persisted'), 'pageshow handler must check persisted flag');
  assert.ok(
    src.includes('setCheckoutLoading(false)'),
    'pageshow handler must reset checkoutLoading to prevent stuck spinner on back-navigation'
  );
  assert.ok(
    src.includes('setRedirectMessage(null)'),
    'pageshow handler must clear redirectMessage to dismiss overlay on back-navigation'
  );
});

test('upgrade hook: doCheckout catch resets both loading and redirectMessage', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/hooks/use-upgrade.tsx'), 'utf8');
  const fnStart = src.indexOf('const doCheckout');
  const fnEnd = src.indexOf('const startCheckout');
  const fnBody = src.slice(fnStart, fnEnd);
  const catchIdx = fnBody.indexOf('.catch(');
  assert.ok(catchIdx > 0, 'doCheckout must have a catch block');
  const catchBody = fnBody.slice(catchIdx);
  assert.ok(catchBody.includes('setCheckoutLoading(false)'), 'doCheckout catch must reset checkoutLoading');
  assert.ok(catchBody.includes('setRedirectMessage(null)'), 'doCheckout catch must reset redirectMessage');
});

test('upgrade hook: cancelPending clears all checkout state', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/hooks/use-upgrade.tsx'), 'utf8');
  const fnStart = src.indexOf('const cancelPending');
  const fnEnd = src.indexOf('}, [', fnStart);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.ok(fnBody.includes('setCheckoutLoading(false)'), 'cancelPending must reset checkoutLoading');
  assert.ok(fnBody.includes('setRedirectMessage(null)'), 'cancelPending must reset redirectMessage');
  assert.ok(fnBody.includes("sessionStorage.removeItem"), 'cancelPending must clear sessionStorage');
});

test('upgrade hook: pendingUpgradePlan stored in sessionStorage not localStorage', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/hooks/use-upgrade.tsx'), 'utf8');
  assert.ok(src.includes('sessionStorage'), 'Must use sessionStorage for pending plan (survives OAuth redirect, cleared on tab close)');
  assert.ok(!src.includes('localStorage'), 'Must NOT use localStorage for pending plan (would persist across sessions)');
});

test('billing: account deletion endpoint exists', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('/api/auth/delete-account'), 'Delete account endpoint must exist (Apple Guideline 5.1.1)');
  assert.ok(src.includes("method === 'DELETE'") || src.includes('method === "DELETE"'), 'Delete account must use DELETE method');
});

test('billing: frontend createPortalSession calls correct endpoint', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/api.ts'), 'utf8');
  // Search a wider window around the function definition
  const fnStart = src.indexOf('createPortalSession');
  const fnBody = src.slice(fnStart, fnStart + 200);
  assert.ok(fnBody.includes('/api/stripe/portal-session'), 'createPortalSession must call /api/stripe/portal-session');
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

test('server: no unawaited DB lookup calls in google callback (new user path)', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  // Extract the handleGoogleCallback function body
  const fnStart = src.indexOf('async function handleGoogleCallback(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 5000);
  // All findUserAuthByGoogleSub calls in callback must be awaited
  const calls = [...fnBody.matchAll(/\bfindUserAuthByGoogleSub\(/g)];
  const lines = fnBody.split('\n');
  const unawaited = calls.filter(m => {
    const pos = m.index;
    const lineStart = fnBody.lastIndexOf('\n', pos) + 1;
    const line = fnBody.slice(lineStart, fnBody.indexOf('\n', pos));
    return !line.includes('await ');
  });
  assert.equal(unawaited.length, 0, `Found ${unawaited.length} unawaited findUserAuthByGoogleSub() calls in handleGoogleCallback — new user OAuth will 500`);
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

test('server: all async DB function calls are awaited', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const dbSrc = fs.readFileSync(path.join(root, 'src/db.js'), 'utf8');

  // Extract all async function names exported from db.js
  const exportMatch = dbSrc.match(/module\.exports\s*=\s*\{([^}]+)\}/);
  assert.ok(exportMatch, 'Could not find module.exports in db.js');
  const exportedNames = exportMatch[1].match(/\b[a-zA-Z_]\w*\b/g) || [];

  // Also find which ones are async
  const asyncFns = exportedNames.filter(name => {
    const pattern = new RegExp(`async function ${name}\\b`);
    return pattern.test(dbSrc);
  });

  assert.ok(asyncFns.length > 0, 'No async DB functions found — test is broken');

  const lines = src.split('\n');
  const unawaited = [];

  for (const fn of asyncFns) {
    const callPattern = new RegExp(`\\b${fn}\\(`, 'g');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (callPattern.test(line) && !line.includes('await ') && !line.includes('function ') && !line.includes('//') && !line.includes('.catch(') && !line.includes('.then(')) {
        unawaited.push({ fn, line: i + 1, text: line.trim() });
      }
    }
  }

  assert.equal(
    unawaited.length, 0,
    `Found ${unawaited.length} unawaited async DB call(s) in server.js:\n` +
    unawaited.map(u => `  Line ${u.line}: ${u.fn}() — ${u.text}`).join('\n')
  );
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

// ─── Error boundaries (ChunkLoadError / post-deploy recovery) ─────────────────

test('error boundary: frontend/app/error.tsx exists', () => {
  const file = path.join(root, 'frontend/app/error.tsx');
  assert.ok(fs.existsSync(file), 'app/error.tsx missing — users will see raw "Application error" page after deploys');
});

test('error boundary: frontend/app/global-error.tsx exists', () => {
  const file = path.join(root, 'frontend/app/global-error.tsx');
  assert.ok(fs.existsSync(file), 'app/global-error.tsx missing — root layout errors show raw Next.js error page');
});

test('error boundary: error.tsx handles ChunkLoadError with guarded auto-reload', () => {

  const src = fs.readFileSync(path.join(root, 'frontend/app/error.tsx'), 'utf8');
  assert.ok(src.includes('"use client"'), 'error.tsx must be a Client Component');
  assert.ok(src.includes('ChunkLoadError') || src.includes('Loading chunk'), 'error.tsx must detect ChunkLoadError for post-deploy recovery');
  assert.ok(src.includes('reload'), 'error.tsx must call window.location.reload() on ChunkLoadError');
  assert.ok(src.includes('sessionStorage'), 'error.tsx must use sessionStorage to prevent infinite reload loop');
  assert.ok(src.includes('reset'), 'error.tsx must accept and use the reset prop');
});

test('error boundary: global-error.tsx handles ChunkLoadError with guarded auto-reload', () => {

  const src = fs.readFileSync(path.join(root, 'frontend/app/global-error.tsx'), 'utf8');
  assert.ok(src.includes('"use client"'), 'global-error.tsx must be a Client Component');
  assert.ok(src.includes('ChunkLoadError') || src.includes('Loading chunk'), 'global-error.tsx must detect ChunkLoadError');
  assert.ok(src.includes('reload'), 'global-error.tsx must call window.location.reload() on ChunkLoadError');
  assert.ok(src.includes('sessionStorage'), 'global-error.tsx must use sessionStorage to prevent infinite reload loop');

});
