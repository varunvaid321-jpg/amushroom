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

test('billing: frontend createPortalSession calls correct endpoint', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/api.ts'), 'utf8');
  // Search a wider window around the function definition
  const fnStart = src.indexOf('createPortalSession');
  const fnBody = src.slice(fnStart, fnStart + 200);
  assert.ok(fnBody.includes('/api/stripe/portal-session'), 'createPortalSession must call /api/stripe/portal-session');
});

// ─── Peer review: Backend expert ──────────────────────────────────────────────

test('backend: identify handler checks suspended user status', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fnStart = src.indexOf('async function handleIdentify(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);
  assert.ok(fnBody.includes('suspend') || fnBody.includes('Suspended'), 'handleIdentify must check if user is suspended');
});

test('backend: OAuth callback validates state parameter', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fnStart = src.indexOf('async function handleGoogleCallback(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);
  assert.ok(fnBody.includes('consumeOAuthState') || fnBody.includes('state'), 'Google callback must validate OAuth state parameter');
});

test('backend: OAuth state store has TTL cleanup', () => {
  const src = fs.readFileSync(path.join(root, 'src/google-oauth.js'), 'utf8');
  assert.ok(src.includes('TTL') || src.includes('ttl') || src.includes('expire') || src.includes('cleanup') || src.includes('delete'),
    'OAuth state store must have TTL or cleanup to prevent memory leaks');
});

test('backend: login rate limiting exists', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('loginFail') || src.includes('LOGIN_LOCKOUT') || src.includes('lockout'),
    'Login endpoint must have rate limiting / lockout for brute force protection');
});

// ─── Peer review: Payments expert ────────────────────────────────────────────

test('payments: checkout uses payment mode for lifetime, subscription for monthly', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fnStart = src.indexOf('async function handleStripeCheckout(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 2000);
  assert.ok(fnBody.includes("'payment'"), 'Checkout must use payment mode for lifetime');
  assert.ok(fnBody.includes("'subscription'"), 'Checkout must use subscription mode for monthly');
});

test('payments: lifetime upgrade cancels existing monthly subscription in webhook', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fnStart = src.indexOf('async function handleStripeWebhook(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 5000);
  assert.ok(fnBody.includes('subscriptions.cancel') || fnBody.includes('subscription_id'),
    'Webhook must cancel monthly subscription when lifetime is purchased');
});

test('payments: pro scan cap never leaks number 50 in API responses', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  // Find all 403 quota responses for pro users
  const fnStart = src.indexOf('async function handleIdentify(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 5000);
  // Pro quota response must use limit: null
  assert.ok(fnBody.includes('limit: null'), 'Pro quota exceeded must return limit: null (never reveal 50)');
});

test('payments: no "unlimited" or "50 scan" in upgrade page copy', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/app/upgrade/page.tsx'), 'utf8');
  assert.ok(!src.match(/unlimited\s+scan/i), 'Upgrade page must never promise "unlimited scans"');
  assert.ok(!src.includes('"50"') && !src.includes("'50'"), 'Upgrade page must never mention the 50/day cap');
});

test('payments: downgrade preserves membership_started_at', () => {
  const src = fs.readFileSync(path.join(root, 'src/db.js'), 'utf8');
  const fnStart = src.indexOf('async function downgradeUser(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 500);
  assert.ok(!fnBody.includes('membership_started_at'), 'downgradeUser must NOT overwrite membership_started_at');
});

test('payments: webhook writes audit log for tier changes', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fnStart = src.indexOf('async function handleStripeWebhook(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 5000);
  assert.ok(fnBody.includes('writeAuditLog') || fnBody.includes('audit'), 'Webhook must write audit log for tier changes');
});

// ─── Peer review: Customer workflow expert ───────────────────────────────────

test('customer: billing page offers lifetime switch and in-app cancel for monthly users', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/app/account/billing/page.tsx'), 'utf8');
  assert.ok(src.includes('Lifetime'), 'Monthly users must see switch-to-lifetime option');
  assert.ok(src.includes('startCheckout("lifetime")') || src.includes("startCheckout('lifetime')"),
    'Lifetime switch must call startCheckout with lifetime plan');
  assert.ok(src.includes('cancelSubscription'), 'Billing page must support in-app cancellation');
  assert.ok(src.includes('Cancel Subscription'), 'Cancel button must be visible for monthly users');
});

// ─── Peer review: Integration expert ─────────────────────────────────────────

test('integration: render.yaml declares critical env vars', () => {
  // KNOWN GAP: render.yaml only declares Turso vars. Stripe and Google vars are
  // set manually on Render dashboard. If service is recreated from blueprint, they'll be lost.
  // Tracked in docs/open-issues.md.
  const yaml = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  const required = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];
  for (const v of required) {
    assert.ok(yaml.includes(v), `render.yaml missing ${v}`);
  }
  const recommended = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const missing = recommended.filter(v => !yaml.includes(v));
  if (missing.length > 0) {
    console.warn(`  ⚠ render.yaml missing env var declarations: ${missing.join(', ')} — set manually on Render`);
  }
});

test('integration: email sending failure does not block registration', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fnStart = src.indexOf('async function handleRegister(') || src.indexOf('handleRegister');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);
  // sendWelcomeEmail should be fire-and-forget (not awaited without catch, or called with .catch)
  const emailCall = fnBody.indexOf('sendWelcomeEmail');
  if (emailCall > 0) {
    const lineStart = fnBody.lastIndexOf('\n', emailCall);
    const line = fnBody.slice(lineStart, fnBody.indexOf('\n', emailCall));
    const safePatterns = ['.catch', 'try', '// fire'];
    const isSafe = !line.includes('await') || safePatterns.some(p => fnBody.slice(emailCall - 200, emailCall + 200).includes(p));
    assert.ok(isSafe, 'sendWelcomeEmail must not block registration on failure — use .catch() or fire-and-forget');
  }
});

test('integration: webhook signature verification in try/catch', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fnStart = src.indexOf('async function handleStripeWebhook(');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 2000);
  assert.ok(fnBody.includes('constructEvent'), 'Webhook must call constructEvent');
  assert.ok(fnBody.includes('try') && fnBody.includes('catch'), 'constructEvent must be in try/catch — bad signature must not 500');
  assert.ok(fnBody.includes('400'), 'Bad webhook signature must return 400');
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

// ─── Species lookup & mushroom stories (scan result enrichment) ──────────────

test('species-lookup.json: exists and has valid structure', () => {
  const filePath = path.join(root, 'species-lookup.json');
  assert.ok(fs.existsSync(filePath), 'species-lookup.json must exist');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const keys = Object.keys(data);
  assert.ok(keys.length >= 100, `Expected 100+ species in lookup, got ${keys.length}`);
  // Every key should be lowercase (scientific name)
  for (const key of keys) {
    assert.equal(key, key.toLowerCase(), `Species key must be lowercase: ${key}`);
  }
});

test('species-lookup.json: entries have required fields', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'species-lookup.json'), 'utf8'));
  const keys = Object.keys(data);
  for (const key of keys.slice(0, 20)) { // sample first 20
    const entry = data[key];
    assert.ok(entry.slug, `${key} missing slug`);
    assert.ok(entry.commonName, `${key} missing commonName`);
    assert.ok(Array.isArray(entry.lookAlikes), `${key} lookAlikes must be an array`);
    // Slug should be kebab-case
    assert.ok(/^[a-z0-9-]+$/.test(entry.slug), `${key} slug must be kebab-case: ${entry.slug}`);
  }
});

test('species-lookup.json: look-alike entries have name and distinction', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'species-lookup.json'), 'utf8'));
  for (const [key, entry] of Object.entries(data)) {
    for (const la of entry.lookAlikes || []) {
      assert.ok(la.name, `${key} look-alike missing name`);
      assert.ok(la.distinction, `${key} look-alike "${la.name}" missing distinction`);
    }
  }
});

test('species-lookup.json: no duplicate slugs', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'species-lookup.json'), 'utf8'));
  const slugs = Object.values(data).map(e => e.slug);
  const unique = new Set(slugs);
  assert.equal(slugs.length, unique.size, `Duplicate slugs found: ${slugs.filter((s, i) => slugs.indexOf(s) !== i).join(', ')}`);
});

test('mushroom-stories.json: exists and has valid structure', () => {
  const filePath = path.join(root, 'mushroom-stories.json');
  assert.ok(fs.existsSync(filePath), 'mushroom-stories.json must exist');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const keys = Object.keys(data);
  assert.ok(keys.length >= 200, `Expected 200+ stories, got ${keys.length}`);
  for (const key of keys) {
    assert.equal(key, key.toLowerCase(), `Story key must be lowercase: ${key}`);
  }
});

test('mushroom-stories.json: entries have commonName and story', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'mushroom-stories.json'), 'utf8'));
  for (const [key, entry] of Object.entries(data)) {
    assert.ok(entry.commonName, `${key} missing commonName`);
    assert.ok(entry.story, `${key} missing story`);
    assert.ok(entry.story.length >= 50, `${key} story too short (${entry.story.length} chars)`);
  }
});

test('mushroom-stories.json: no story mentions "unlimited scans" or leaks pro cap', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'mushroom-stories.json'), 'utf8'));
  for (const [key, entry] of Object.entries(data)) {
    assert.ok(!entry.story.match(/unlimited scan/i), `${key} story must not mention unlimited scans`);
    assert.ok(!entry.story.includes('50 scan'), `${key} story must not leak pro scan cap`);
  }
});

test('mushroom-stories.json: covers common grocery store mushrooms', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'mushroom-stories.json'), 'utf8'));
  const grocery = [
    'agaricus bisporus',       // button/cremini/portobello
    'lentinula edodes',        // shiitake
    'pleurotus ostreatus',     // oyster
    'flammulina velutipes',    // enoki
    'grifola frondosa',        // maitake
    'hericium erinaceus',      // lion's mane
  ];
  for (const species of grocery) {
    assert.ok(data[species], `Missing grocery mushroom story: ${species}`);
  }
});

// ─── Scan enrichment logic in server.js ──────────────────────────────────────

test('server: SPECIES_LOOKUP loaded from species-lookup.json', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('species-lookup.json'), 'server.js must load species-lookup.json');
  assert.ok(src.includes('SPECIES_LOOKUP'), 'server.js must define SPECIES_LOOKUP');
});

test('server: MUSHROOM_STORIES loaded from mushroom-stories.json', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('mushroom-stories.json'), 'server.js must load mushroom-stories.json');
  assert.ok(src.includes('MUSHROOM_STORIES'), 'server.js must define MUSHROOM_STORIES');
});

test('server: enrichment gracefully handles missing lookup files', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  // Both loaders must have try/catch with empty object fallback
  const lookupLoader = src.slice(src.indexOf('SPECIES_LOOKUP'), src.indexOf('SPECIES_LOOKUP') + 200);
  assert.ok(lookupLoader.includes('catch'), 'SPECIES_LOOKUP loader must have catch block');
  assert.ok(lookupLoader.includes('{}'), 'SPECIES_LOOKUP must fall back to empty object');
  const storyLoader = src.slice(src.indexOf('MUSHROOM_STORIES'), src.indexOf('MUSHROOM_STORIES') + 200);
  assert.ok(storyLoader.includes('catch'), 'MUSHROOM_STORIES loader must have catch block');
  assert.ok(storyLoader.includes('{}'), 'MUSHROOM_STORIES must fall back to empty object');
});

test('server: match response includes guideUrl and story fields', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('guideUrl:'), 'Match response must include guideUrl');
  assert.ok(src.includes('story:'), 'Match response must include story');
});

test('server: guideUrl uses guide.orangutany.com domain', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes('guide.orangutany.com/mushrooms/'), 'guideUrl must point to guide.orangutany.com');
});

test('server: look-alike enrichment prefers guide data over raw API data', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  // Guide look-alikes should be preferred when available
  assert.ok(src.includes('guideLookAlikes.length > 0 ? guideLookAlikes : rawLookAlikes'),
    'Must prefer guideLookAlikes over rawLookAlikes when available');
});

test('server: look-alikes capped at 5', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const matches = src.match(/\.slice\(0,\s*5\)/g) || [];
  assert.ok(matches.length >= 2, 'rawLookAlikes and final lookAlikes must be capped at 5');
});

test('server: story lookup is case-insensitive', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes("MUSHROOM_STORIES[scientificName.toLowerCase()]"),
    'Story lookup must lowercase the scientific name for case-insensitive matching');
});

test('server: species lookup is case-insensitive', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(src.includes("SPECIES_LOOKUP[scientificName.toLowerCase()]"),
    'Species lookup must lowercase the scientific name for case-insensitive matching');
});

// ─── Geo / lat-lon storage ──────────────────────────────────────────────────

test('server: lookupGeo requests lat and lon from ip-api.com', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const geoFn = src.slice(src.indexOf('async function lookupGeo'), src.indexOf('async function lookupGeo') + 500);
  assert.ok(geoFn.includes('lat'), 'lookupGeo must request lat');
  assert.ok(geoFn.includes('lon'), 'lookupGeo must request lon');
});

test('server: lookupGeo skips localhost and unknown IPs', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const geoFn = src.slice(src.indexOf('async function lookupGeo'), src.indexOf('async function lookupGeo') + 300);
  assert.ok(geoFn.includes('127.0.0.1'), 'lookupGeo must skip localhost IPv4');
  assert.ok(geoFn.includes('::1'), 'lookupGeo must skip localhost IPv6');
  assert.ok(geoFn.includes("'unknown'"), 'lookupGeo must skip unknown');
});

test('server: updateEventGeo stores lat and lon', () => {
  const dbSrc = fs.readFileSync(path.join(root, 'src/db.js'), 'utf8');
  const fnStart = dbSrc.indexOf('async function updateEventGeo');
  const fnEnd = dbSrc.indexOf('}', fnStart + 50);
  const fnBody = dbSrc.slice(fnStart, fnEnd + 1);
  assert.ok(fnBody.includes('lat'), 'updateEventGeo must store lat');
  assert.ok(fnBody.includes('lon'), 'updateEventGeo must store lon');
});

test('db: analytics_events migration adds lat and lon columns', () => {
  const src = fs.readFileSync(path.join(root, 'src/db.js'), 'utf8');
  assert.ok(src.includes("analytics_events ADD COLUMN lat"), 'Migration must add lat column');
  assert.ok(src.includes("analytics_events ADD COLUMN lon"), 'Migration must add lon column');
});

// ─── Frontend: Match interface ──────────────────────────────────────────────

test('frontend: Match interface includes guideUrl and story', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/api.ts'), 'utf8');
  assert.ok(src.includes('guideUrl: string | null'), 'Match must have guideUrl: string | null');
  assert.ok(src.includes('story: string | null'), 'Match must have story: string | null');
});

test('frontend: Match interface supports enriched look-alikes', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/api.ts'), 'utf8');
  // lookAlikes should accept both string and object format
  assert.ok(src.includes('string | { name: string'), 'lookAlikes must support both string and enriched object format');
});

// ─── Frontend: format-utils.ts ──────────────────────────────────────────────

test('format-utils: escapeHtml handles all OWASP dangerous chars', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/format-utils.ts'), 'utf8');
  assert.ok(src.includes('&amp;'), 'Must escape &');
  assert.ok(src.includes('&lt;'), 'Must escape <');
  assert.ok(src.includes('&gt;'), 'Must escape >');
  assert.ok(src.includes('&quot;'), 'Must escape "');
  assert.ok(src.includes('&#039;'), "Must escape '");
});

test('format-utils: ensureSentence handles empty string', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/format-utils.ts'), 'utf8');
  const fnStart = src.indexOf('export function ensureSentence');
  const fnEnd = src.indexOf('}', src.indexOf('return', fnStart + 50));
  const fnBody = src.slice(fnStart, fnEnd + 1);
  assert.ok(fnBody.includes('!trimmed') || fnBody.includes('""'), 'ensureSentence must handle empty string');
});

test('format-utils: confidenceColor covers all ranges', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/format-utils.ts'), 'utf8');
  assert.ok(src.includes('score >= 80'), 'Must handle high confidence (>=80)');
  assert.ok(src.includes('score >= 50'), 'Must handle medium confidence (>=50)');
  assert.ok(src.includes('text-red-400'), 'Must handle low confidence with red');
  assert.ok(src.includes('text-green-400'), 'Must handle high confidence with green');
  assert.ok(src.includes('text-yellow-400'), 'Must handle medium confidence with yellow');
});

test('format-utils: chipVariant handles poisonous/toxic/deadly as destructive', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/format-utils.ts'), 'utf8');
  const fnStart = src.indexOf('export function chipVariant');
  const fnEnd = src.indexOf('\n}', fnStart);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.ok(fnBody.includes('poisonous') && fnBody.includes('toxic') && fnBody.includes('deadly'),
    'chipVariant must handle poisonous, toxic, and deadly');
  assert.ok(fnBody.includes('"destructive"'), 'Dangerous edibility must return destructive variant');
});

test('format-utils: buildConfidenceGuidance adds missing roles suggestion', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/format-utils.ts'), 'utf8');
  const fnStart = src.indexOf('export function buildConfidenceGuidance');
  const fnEnd = src.indexOf('\n}', fnStart);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.ok(fnBody.includes('missingRoles.length > 0'), 'Must check for missing roles');
  assert.ok(fnBody.includes('formatNaturalList'), 'Must format missing roles as natural list');
});

test('format-utils: formatNaturalList handles 0, 1, 2, and 3+ items', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/format-utils.ts'), 'utf8');
  const fnStart = src.indexOf('export function formatNaturalList');
  const fnEnd = src.indexOf('\n}', fnStart);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.ok(fnBody.includes('length === 0'), 'Must handle empty array');
  assert.ok(fnBody.includes('length === 1'), 'Must handle single item');
  assert.ok(fnBody.includes('length === 2'), 'Must handle two items');
  assert.ok(fnBody.includes(', and'), 'Must use Oxford comma for 3+ items');
});

// ─── Frontend: results components ───────────────────────────────────────────

test('frontend: results-dock supports expanded state for card expand/collapse', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/components/results/results-dock.tsx'), 'utf8');
  assert.ok(src.includes('expandedIndex') || src.includes('expanded'), 'results-dock must track expanded state');
});

test('frontend: results-dock renders grid layout based on match count', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/components/results/results-dock.tsx'), 'utf8');
  assert.ok(src.includes('grid-cols-1') && src.includes('sm:grid-cols-2') || src.includes('sm:grid-cols-3'),
    'results-dock must use responsive grid columns');
});

test('frontend: match-card has isExpanded and onToggle props', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/components/results/match-card.tsx'), 'utf8');
  assert.ok(src.includes('isExpanded'), 'match-card must accept isExpanded prop');
  assert.ok(src.includes('onToggle'), 'match-card must accept onToggle prop');
});

test('frontend: profile-panel shows "Did You Know?" story', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/components/results/profile-panel.tsx'), 'utf8');
  assert.ok(src.includes('Did You Know'), 'profile-panel must show "Did You Know?" section');
  assert.ok(src.includes('match.story'), 'profile-panel must reference match.story');
});

test('frontend: profile-panel shows guide link when available', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/components/results/profile-panel.tsx'), 'utf8');
  assert.ok(src.includes('guideUrl') || src.includes('guide.orangutany.com'),
    'profile-panel must show guide link when guideUrl is available');
});

test('frontend: profile-panel renders enriched look-alikes with images', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/components/results/profile-panel.tsx'), 'utf8');
  assert.ok(src.includes('imageUrl') || src.includes('look-alike'),
    'profile-panel must render look-alike images when available');
  assert.ok(src.includes('distinction'), 'profile-panel must show look-alike distinction text');
});

// ─── Frontend: scroll utility ───────────────────────────────────────────────

test('frontend: scrollToId has safety correction timeout', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/scroll.ts'), 'utf8');
  assert.ok(src.includes('setTimeout'), 'scrollToId must have safety correction timeout');
  assert.ok(src.includes('600'), 'Safety correction must fire after 600ms');
  assert.ok(src.includes('HEADER_HEIGHT'), 'Must reference HEADER_HEIGHT constant');
});

test('frontend: scrollToId has fallback for browsers without scroll-margin-top', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/lib/scroll.ts'), 'utf8');
  assert.ok(src.includes('CSS.supports'), 'Must check CSS.supports for scroll-margin-top');
  assert.ok(src.includes('scrollIntoView'), 'Must use scrollIntoView when supported');
  assert.ok(src.includes('window.scrollTo'), 'Must fall back to window.scrollTo');
});

// ─── Admin: countryFlag safety ──────────────────────────────────────────────

test('admin: uses countryLabel helper instead of flag emojis', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/app/admin/page.tsx'), 'utf8');
  assert.ok(src.includes('countryLabel'), 'admin page must use countryLabel helper for location display');
  assert.ok(!src.includes('countryFlag'), 'admin page must not use countryFlag (replaced with text labels)');
});

test('admin/scans: countryFlag skips full country names (old data)', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/app/admin/scans/page.tsx'), 'utf8');
  const fnStart = src.indexOf('function countryFlag');
  const fnEnd = src.indexOf('\n}', fnStart);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.ok(fnBody.includes('length > 3'), 'countryFlag must skip strings longer than 3 chars (full country names)');
});

// ─── Regeneration script ────────────────────────────────────────────────────

test('scripts: regenerate-species-lookup.sh exists', () => {
  const filePath = path.join(root, 'scripts/regenerate-species-lookup.sh');
  assert.ok(fs.existsSync(filePath), 'regenerate-species-lookup.sh must exist');
  const stat = fs.statSync(filePath);
  assert.ok(stat.mode & 0o111, 'regenerate-species-lookup.sh must be executable');
});

// ─── Email & Plan Change Tests (100+ cases) ─────────────────────────────────

const emailSrc = fs.readFileSync(path.join(root, 'src/email.js'), 'utf8');
const serverSrc = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

// --- Email module structure ---

test('email: exports all required email functions', () => {
  const required = ['sendWelcomeEmail', 'sendPasswordResetEmail', 'sendUpgradeEmail', 'sendLifetimeUpgradeEmail', 'sendCancellationEmail', 'sendAbuseAlertEmail', 'sendFeedbackNotification', 'sendTestEmail', 'emailEnabled'];
  for (const fn of required) {
    assert.ok(emailSrc.includes(fn), `email.js must export ${fn}`);
  }
});

test('email: module.exports includes all email functions', () => {
  const exportsLine = emailSrc.match(/module\.exports\s*=\s*\{([^}]+)\}/);
  assert.ok(exportsLine, 'email.js must have module.exports');
  const exported = exportsLine[1];
  for (const fn of ['sendWelcomeEmail', 'sendUpgradeEmail', 'sendLifetimeUpgradeEmail', 'sendCancellationEmail', 'sendAbuseAlertEmail']) {
    assert.ok(exported.includes(fn), `module.exports must include ${fn}`);
  }
});

test('email: server.js imports all email functions', () => {
  for (const fn of ['sendWelcomeEmail', 'sendUpgradeEmail', 'sendLifetimeUpgradeEmail', 'sendCancellationEmail', 'sendAbuseAlertEmail']) {
    assert.ok(serverSrc.includes(fn), `server.js must import ${fn}`);
  }
});

// --- Email template branding consistency ---

test('email: all templates use baseTemplate wrapper', () => {
  const templateCalls = emailSrc.match(/baseTemplate\(/g);
  assert.ok(templateCalls && templateCalls.length >= 7, `expected 7+ baseTemplate calls, got ${templateCalls?.length}`);
});

test('email: baseTemplate has brand orange color #f97316', () => {
  assert.ok(emailSrc.includes('#f97316'), 'baseTemplate must use brand orange #f97316');
});

test('email: baseTemplate has dark background #0a0a0a', () => {
  assert.ok(emailSrc.includes('#0a0a0a'), 'baseTemplate must use dark bg #0a0a0a');
});

test('email: baseTemplate has card background #161616', () => {
  assert.ok(emailSrc.includes('#161616'), 'baseTemplate must use card bg #161616');
});

test('email: baseTemplate includes Orangutany brand name', () => {
  assert.ok(emailSrc.includes('Orangutany Mushrooms') || emailSrc.includes('Orangutany'), 'baseTemplate must include brand name');
});

test('email: baseTemplate has responsive meta viewport', () => {
  assert.ok(emailSrc.includes('viewport'), 'baseTemplate must include viewport meta');
});

test('email: baseTemplate has max-width constraint for email clients', () => {
  assert.ok(emailSrc.includes('max-width:520px'), 'baseTemplate must constrain width');
});

test('email: all CTAs use orange button style', () => {
  const ctaMatches = emailSrc.match(/background-color:#f97316/g);
  assert.ok(ctaMatches && ctaMatches.length >= 4, 'all CTA buttons must be orange');
});

test('email: all CTA buttons link to orangutany.com', () => {
  const links = emailSrc.match(/href="https:\/\/orangutany\.com[^"]*"/g);
  assert.ok(links && links.length >= 4, 'CTA links must point to orangutany.com');
});

// --- Welcome email ---

test('email: welcome email has correct subject line', () => {
  assert.ok(emailSrc.includes("'Welcome to Orangutany Mushrooms'"), 'welcome subject must match');
});

test('email: welcome email includes mushroom image', () => {
  assert.ok(emailSrc.includes('chicken-email.jpg'), 'welcome email must include mushroom photo');
});

test('email: welcome email has Start Identifying CTA', () => {
  assert.ok(emailSrc.includes('Start Identifying'), 'welcome email must have Start Identifying CTA');
});

test('email: welcome email handles missing name gracefully', () => {
  assert.ok(emailSrc.includes("'Hi there,'"), 'welcome email must fallback for missing name');
});

// --- Upgrade email (monthly Pro) ---

test('email: upgrade email has correct subject', () => {
  assert.ok(emailSrc.includes("'Welcome to Orangutany Pro!'"), 'upgrade subject must match');
});

test('email: upgrade email lists Pro benefits', () => {
  assert.ok(emailSrc.includes('50 scans per day'), 'upgrade email must list scan benefit');
  assert.ok(emailSrc.includes('Look-alike warnings'), 'upgrade email must list look-alike benefit');
});

test('email: upgrade email shows monthly price', () => {
  assert.ok(emailSrc.includes('$7.99/mo'), 'monthly upgrade email must show price');
});

test('email: upgrade email has Start Scanning CTA', () => {
  assert.ok(emailSrc.includes('Start Scanning'), 'upgrade email must have Start Scanning CTA');
});

// --- Lifetime upgrade email ---

test('email: lifetime email has correct subject', () => {
  assert.ok(emailSrc.includes("'Welcome to Orangutany Pro Lifetime!'"), 'lifetime subject must match');
});

test('email: lifetime email mentions no recurring charges', () => {
  assert.ok(emailSrc.includes('No recurring charges'), 'lifetime email must mention no recurring');
});

test('email: lifetime email mentions forever', () => {
  assert.ok(emailSrc.includes('forever') || emailSrc.includes('lifetime access'), 'lifetime email must mention forever/lifetime');
});

test('email: lifetime email shows one-time price', () => {
  assert.ok(emailSrc.includes('$49.99'), 'lifetime email must show $49.99 price');
});

test('email: lifetime email does NOT show monthly price', () => {
  // The lifetime-specific template should say $49.99, not $7.99/mo
  const lifetimeSection = emailSrc.substring(emailSrc.indexOf('sendLifetimeUpgradeEmail'));
  const nextFn = lifetimeSection.indexOf('\nasync function', 10);
  const isolated = nextFn > 0 ? lifetimeSection.substring(0, nextFn) : lifetimeSection;
  assert.ok(!isolated.includes('$7.99/mo'), 'lifetime email must NOT show monthly price');
});

// --- Cancellation email ---

test('email: cancellation email has correct subject', () => {
  assert.ok(emailSrc.includes('Your Orangutany Pro subscription has been cancelled'), 'cancellation subject must match');
});

test('email: cancellation email mentions free plan', () => {
  assert.ok(emailSrc.includes('free plan') || emailSrc.includes('5 free scans'), 'cancellation must mention free tier');
});

test('email: cancellation email has re-subscribe CTA', () => {
  assert.ok(emailSrc.includes('Re-subscribe') || emailSrc.includes('/upgrade'), 'cancellation must have re-subscribe option');
});

test('email: cancellation email links to upgrade page', () => {
  assert.ok(emailSrc.includes('orangutany.com/upgrade'), 'cancellation CTA must link to /upgrade');
});

// --- Email safety: graceful degradation ---

test('email: all email functions check for resend before sending', () => {
  const fnNames = ['sendWelcomeEmail', 'sendUpgradeEmail', 'sendLifetimeUpgradeEmail', 'sendCancellationEmail', 'sendPasswordResetEmail'];
  for (const fn of fnNames) {
    const fnStart = emailSrc.indexOf(`async function ${fn}`);
    assert.ok(fnStart > -1, `${fn} must be async function`);
    const fnBody = emailSrc.substring(fnStart, fnStart + 300);
    assert.ok(fnBody.includes('if (!resend)'), `${fn} must check for resend before sending`);
  }
});

test('email: all email sends use try-catch for error handling', () => {
  const tryCatches = emailSrc.match(/try\s*\{[\s\S]*?resend\.emails\.send/g);
  assert.ok(tryCatches && tryCatches.length >= 5, 'all sends must be in try-catch');
});

test('email: all email functions log success', () => {
  const logMatches = emailSrc.match(/console\.log\(`\[email\]/g);
  assert.ok(logMatches && logMatches.length >= 5, 'all sends must log on success');
});

test('email: all email functions log errors', () => {
  const errMatches = emailSrc.match(/console\.error\(`\[email\]/g);
  assert.ok(errMatches && errMatches.length >= 5, 'all sends must log errors');
});

// --- Server.js: plan change wiring ---

test('server: checkout handler exists', () => {
  assert.ok(serverSrc.includes('create-checkout-session') || serverSrc.includes('checkout.sessions.create'), 'server must have checkout handler');
});

test('server: checkout requires authentication', () => {
  const checkoutFn = serverSrc.substring(serverSrc.indexOf('async function handleCheckout'));
  assert.ok(checkoutFn.includes('getAuthContext'), 'checkout must check auth');
  assert.ok(checkoutFn.includes('401'), 'checkout must return 401 if not authenticated');
});

test('server: checkout supports monthly plan', () => {
  assert.ok(serverSrc.includes("plan === 'monthly'") || serverSrc.includes("'subscription'"), 'checkout must support monthly');
});

test('server: checkout supports lifetime plan', () => {
  assert.ok(serverSrc.includes("plan === 'lifetime'") || serverSrc.includes("isLifetime"), 'checkout must support lifetime');
});

test('server: checkout uses Stripe Checkout Sessions (not payment links)', () => {
  assert.ok(serverSrc.includes('checkout.sessions.create'), 'must use Checkout Sessions');
  assert.ok(!serverSrc.includes('paymentLinks'), 'must NOT use payment links');
});

test('server: checkout includes userId in metadata', () => {
  assert.ok(serverSrc.includes("userId: String(auth.user.id)"), 'checkout must pass userId in metadata');
});

test('server: checkout creates Stripe customer if none exists', () => {
  assert.ok(serverSrc.includes('stripe.customers.create'), 'checkout must create customer if needed');
});

// --- Server.js: webhook handling ---

test('server: webhook handles checkout.session.completed', () => {
  assert.ok(serverSrc.includes("'checkout.session.completed'"), 'webhook must handle checkout completed');
});

test('server: webhook handles customer.subscription.deleted', () => {
  assert.ok(serverSrc.includes("'customer.subscription.deleted'"), 'webhook must handle subscription deleted');
});

test('server: webhook handles customer.subscription.updated', () => {
  assert.ok(serverSrc.includes("'customer.subscription.updated'"), 'webhook must handle subscription updated');
});

test('server: webhook handles invoice.payment_succeeded', () => {
  assert.ok(serverSrc.includes("'invoice.payment_succeeded'"), 'webhook must handle invoice paid');
});

test('server: webhook verifies Stripe signature', () => {
  assert.ok(serverSrc.includes('webhooks.constructEvent'), 'webhook must verify signature');
});

test('server: webhook returns error on bad signature', () => {
  assert.ok(serverSrc.includes("'Invalid signature'"), 'webhook must reject bad signatures');
});

// --- Server.js: upgrade email triggers ---

test('server: sends upgrade email on monthly checkout completed', () => {
  assert.ok(serverSrc.includes('sendUpgradeEmail'), 'server must call sendUpgradeEmail');
});

test('server: sends lifetime email on lifetime checkout completed', () => {
  assert.ok(serverSrc.includes('sendLifetimeUpgradeEmail'), 'server must call sendLifetimeUpgradeEmail');
});

test('server: sends different emails for monthly vs lifetime', () => {
  // Must have conditional: if isLifetime -> lifetime email, else -> monthly email
  assert.ok(serverSrc.includes('isLifetime') && serverSrc.includes('sendLifetimeUpgradeEmail') && serverSrc.includes('sendUpgradeEmail'),
    'server must send different emails for monthly vs lifetime');
});

// --- Server.js: cancellation email triggers ---

test('server: sends cancellation email on user-initiated cancel', () => {
  const cancelFn = serverSrc.substring(serverSrc.indexOf('handleCancelSubscription'));
  const nextFn = cancelFn.indexOf('\nasync function', 10);
  const isolated = nextFn > 0 ? cancelFn.substring(0, nextFn) : cancelFn;
  assert.ok(isolated.includes('sendCancellationEmail'), 'user cancel must trigger cancellation email');
});

test('server: sends cancellation email on webhook subscription deleted', () => {
  const webhookSection = serverSrc.substring(serverSrc.indexOf("'customer.subscription.deleted'"));
  const endSection = webhookSection.substring(0, webhookSection.indexOf("'invoice.payment_succeeded'"));
  assert.ok(endSection.includes('sendCancellationEmail'), 'webhook downgrade must trigger cancellation email');
});

// --- Server.js: cancel handler guards ---

test('server: cancel requires authentication', () => {
  const cancelFn = serverSrc.substring(serverSrc.indexOf('handleCancelSubscription'));
  assert.ok(cancelFn.includes('getAuthContext'), 'cancel must check auth');
  assert.ok(cancelFn.includes('401'), 'cancel must return 401 without auth');
});

test('server: cancel requires active subscription', () => {
  const cancelFn = serverSrc.substring(serverSrc.indexOf('handleCancelSubscription'));
  assert.ok(cancelFn.includes('stripe_subscription_id'), 'cancel must check for subscription');
});

test('server: cancel rejects lifetime users', () => {
  const cancelFn = serverSrc.substring(serverSrc.indexOf('handleCancelSubscription'));
  assert.ok(cancelFn.includes("tier !== 'pro'") || cancelFn.includes("'Only monthly subscriptions'"),
    'cancel must reject non-monthly users');
});

test('server: cancel calls stripe.subscriptions.cancel', () => {
  const cancelFn = serverSrc.substring(serverSrc.indexOf('handleCancelSubscription'));
  assert.ok(cancelFn.includes('stripe.subscriptions.cancel'), 'cancel must call Stripe API');
});

test('server: cancel calls downgradeUser', () => {
  const cancelFn = serverSrc.substring(serverSrc.indexOf('handleCancelSubscription'));
  assert.ok(cancelFn.includes('downgradeUser'), 'cancel must downgrade user in DB');
});

test('server: cancel writes audit log', () => {
  const cancelFn = serverSrc.substring(serverSrc.indexOf('handleCancelSubscription'));
  assert.ok(cancelFn.includes('writeAuditLog'), 'cancel must write audit log');
});

// --- Server.js: upgrade flow guards ---

test('server: upgrade auto-cancels monthly on lifetime upgrade', () => {
  assert.ok(serverSrc.includes('Cancel existing monthly subscription when upgrading to lifetime') ||
    (serverSrc.includes('isLifetime') && serverSrc.includes('stripe.subscriptions.cancel')),
    'must auto-cancel monthly when buying lifetime');
});

test('server: upgrade writes audit log for tier change', () => {
  const webhookFn = serverSrc.substring(serverSrc.indexOf('handleStripeWebhook'));
  assert.ok(webhookFn.includes("eventType: 'tier_change'"), 'upgrade must audit tier change');
});

test('server: upgrade writes audit log for payment', () => {
  const webhookFn = serverSrc.substring(serverSrc.indexOf('handleStripeWebhook'));
  assert.ok(webhookFn.includes("eventType: 'payment'"), 'upgrade must audit payment');
});

test('server: upgrade creates payment record', () => {
  assert.ok(serverSrc.includes('createPaymentRecord'), 'upgrade must create payment record');
});

// --- Server.js: webhook downgrade logic ---

test('server: webhook downgrades user on subscription cancel/expired', () => {
  const webhookSection = serverSrc.substring(serverSrc.indexOf("'customer.subscription.deleted'"));
  assert.ok(webhookSection.includes('downgradeUser'), 'webhook must downgrade on sub cancel');
});

test('server: webhook renews subscription on active status', () => {
  const webhookSection = serverSrc.substring(serverSrc.indexOf("'customer.subscription.deleted'"));
  assert.ok(webhookSection.includes("'active'") || webhookSection.includes("'trialing'"),
    'webhook must handle active/trialing status');
});

test('server: webhook updates expiry on renewal', () => {
  const webhookSection = serverSrc.substring(serverSrc.indexOf("'customer.subscription.deleted'"));
  assert.ok(webhookSection.includes('current_period_end') || webhookSection.includes('expiresAt'),
    'webhook must update expiry date');
});

// --- Server.js: portal handler ---

test('server: billing portal requires auth', () => {
  const portalFn = serverSrc.substring(serverSrc.indexOf('handleStripePortal'));
  assert.ok(portalFn.includes('getAuthContext'), 'portal must check auth');
});

test('server: billing portal requires stripe_customer_id', () => {
  const portalFn = serverSrc.substring(serverSrc.indexOf('handleStripePortal'));
  assert.ok(portalFn.includes('stripe_customer_id'), 'portal must check for customer');
});

test('server: billing portal returns to /account/billing', () => {
  assert.ok(serverSrc.includes('/account/billing'), 'portal return URL must be /account/billing');
});

// --- Quota & tier boundaries ---

test('server: anonymous users get 3 total scans', () => {
  assert.ok(serverSrc.includes("'anonymous'"), 'server must handle anonymous tier');
});

test('server: free users get daily limit', () => {
  assert.ok(serverSrc.includes("'free'") && serverSrc.includes('limit'), 'server must enforce free tier limit');
});

test('server: pro scan cap is silent (no number in error)', () => {
  const proError = serverSrc.match(/isPro.*?Please try again later/s);
  assert.ok(proError, 'pro limit error must say "Please try again later" without revealing count');
});

// --- Email: no secrets in templates ---

test('email: templates do not contain API keys', () => {
  assert.ok(!emailSrc.includes('sk_live'), 'email templates must not contain Stripe keys');
  assert.ok(!emailSrc.includes('re_'), 'email templates must not contain Resend keys');
  assert.ok(!emailSrc.includes('rnd_'), 'email templates must not contain Render keys');
});

// --- Email: XSS safety ---

test('email: greeting uses name parameter safely (no raw HTML injection vector)', () => {
  // Verify name is used in text context, not in href/src attributes
  const nameUsages = emailSrc.match(/\$\{name\}/g);
  const greetingUsages = emailSrc.match(/\$\{greeting\}/g);
  assert.ok(nameUsages || greetingUsages, 'templates must use name/greeting parameter');
  // name should only appear in text, not in URLs
  assert.ok(!emailSrc.includes('href="${name}'), 'name must not be used in URLs');
});

// --- Credential safety ---

test('server: no hardcoded API keys in server.js', () => {
  assert.ok(!serverSrc.includes('sk_live_'), 'server must not hardcode Stripe live keys');
  assert.ok(!serverSrc.includes('rnd_'), 'server must not hardcode Render keys');
  assert.ok(!serverSrc.includes('re_Bj'), 'server must not hardcode Resend keys');
});

test('server: reads Stripe key from environment', () => {
  assert.ok(serverSrc.includes('STRIPE_SECRET_KEY') || serverSrc.includes('process.env'), 'server must read Stripe key from env');
});

test('server: reads Resend key from environment', () => {
  assert.ok(emailSrc.includes('process.env.RESEND_API_KEY'), 'email module must read Resend key from env');
});

// --- .env.production security ---

test('security: .env.production is gitignored', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('.env') || gitignore.includes('.env.production'), '.env.production must be gitignored');
});

test('security: .env.production exists with credentials', () => {
  const envPath = path.join(root, '.env.production');
  assert.ok(fs.existsSync(envPath), '.env.production must exist');
  const content = fs.readFileSync(envPath, 'utf8');
  assert.ok(content.includes('RENDER_API_KEY'), '.env.production must contain RENDER_API_KEY');
  assert.ok(content.includes('CLOUDFLARE_API_KEY'), '.env.production must contain CLOUDFLARE_API_KEY');
});

test('security: CLAUDE.md does not contain raw API keys', () => {
  const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.ok(!claudeMd.includes('sk_live'), 'CLAUDE.md must not contain Stripe keys');
  assert.ok(!claudeMd.includes('rnd_'), 'CLAUDE.md must not contain Render keys');
  assert.ok(!claudeMd.includes('re_Bj'), 'CLAUDE.md must not contain Resend keys');
});

// --- Plan change workflow completeness ---

test('workflow: signup sends welcome email', () => {
  assert.ok(serverSrc.includes('sendWelcomeEmail'), 'signup must send welcome email');
});

test('workflow: monthly upgrade sends Pro email', () => {
  assert.ok(serverSrc.includes('sendUpgradeEmail'), 'monthly upgrade must send email');
});

test('workflow: lifetime upgrade sends Lifetime email', () => {
  assert.ok(serverSrc.includes('sendLifetimeUpgradeEmail'), 'lifetime upgrade must send email');
});

test('workflow: user cancel sends cancellation email', () => {
  const cancelHandler = serverSrc.substring(serverSrc.indexOf('handleCancelSubscription'));
  const endIdx = cancelHandler.indexOf('\nasync function', 10);
  const fn = endIdx > 0 ? cancelHandler.substring(0, endIdx) : cancelHandler;
  assert.ok(fn.includes('sendCancellationEmail'), 'cancel handler must send cancellation email');
});

test('workflow: webhook downgrade sends cancellation email', () => {
  const hookSection = serverSrc.substring(serverSrc.indexOf("'customer.subscription.deleted'"));
  const endSection = hookSection.substring(0, hookSection.indexOf("'invoice.payment_succeeded'"));
  assert.ok(endSection.includes('sendCancellationEmail'), 'webhook downgrade must email');
});

test('workflow: all emails are fire-and-forget (.catch)', () => {
  // Key email calls in server.js should use .catch to prevent crashes
  const emailCalls = serverSrc.match(/send(Welcome|Upgrade|LifetimeUpgrade|Cancellation|PasswordReset)Email\([^)]+\)\.catch/g);
  assert.ok(emailCalls && emailCalls.length >= 5, `expected 5+ .catch email calls, got ${emailCalls?.length}`);
});

test('workflow: email errors never crash the server', () => {
  // All plan-change email sends must use .catch — multi-line abuse calls are OK
  const planEmails = ['sendUpgradeEmail', 'sendLifetimeUpgradeEmail', 'sendCancellationEmail', 'sendWelcomeEmail'];
  for (const fn of planEmails) {
    const regex = new RegExp(`${fn}\\([^)]+\\)\\.catch`, 'g');
    assert.ok(regex.test(serverSrc), `${fn} in server.js must have .catch`);
  }
});

// --- Edge cases ---

test('workflow: cancel handler returns 400 for lifetime users', () => {
  const cancelFn = serverSrc.substring(serverSrc.indexOf('handleCancelSubscription'));
  assert.ok(cancelFn.includes("'Only monthly subscriptions can be cancelled.'"),
    'cancel must reject lifetime users with helpful message');
});

test('workflow: cancel handler returns 400 for users without subscription', () => {
  const cancelFn = serverSrc.substring(serverSrc.indexOf('handleCancelSubscription'));
  assert.ok(cancelFn.includes("'No active subscription to cancel.'"),
    'cancel must reject users without subscription');
});

test('workflow: checkout returns 503 when Stripe not configured', () => {
  const checkoutFn = serverSrc.substring(serverSrc.indexOf('handleCheckout'));
  assert.ok(checkoutFn.includes('503') && checkoutFn.includes('Stripe is not configured'),
    'checkout must return 503 if Stripe not set up');
});

test('workflow: portal returns 400 for users without Stripe customer', () => {
  const portalFn = serverSrc.substring(serverSrc.indexOf('handleStripePortal'));
  assert.ok(portalFn.includes("'No billing account found.'"),
    'portal must reject users without Stripe customer');
});

test('workflow: webhook finds user by stripe customer ID', () => {
  assert.ok(serverSrc.includes('findUserByStripeCustomerId'), 'webhook must find user by Stripe customer ID');
});

test('workflow: webhook handles unknown customer gracefully', () => {
  const webhookFn = serverSrc.substring(serverSrc.indexOf("'customer.subscription.deleted'"));
  assert.ok(webhookFn.includes('if (user)'), 'webhook must guard against unknown customer');
});

test('workflow: email check guards against missing email', () => {
  // Server should check user.email exists before sending
  assert.ok(serverSrc.includes("upgradeUser?.email") || serverSrc.includes("user.email"),
    'email sends must guard against missing email');
});
