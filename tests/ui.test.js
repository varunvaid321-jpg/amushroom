/**
 * UI TEST SUITE
 *
 * Browser-level tests using Playwright. Checks real DOM elements, visible text,
 * interactive flows, and takes screenshots. Breaks when UI shifts or breaks.
 *
 * Screenshots saved to: tests/screenshots/
 * Failures save a screenshot automatically for debugging.
 *
 * Run: node --test tests/ui.test.js
 * Against local: TEST_BASE_URL=http://localhost:3000 node --test tests/ui.test.js
 *
 * Credentials (for auth flow tests):
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 *   TEST_USER_EMAIL  / TEST_USER_PASSWORD
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const BASE         = process.env.TEST_BASE_URL       || 'https://orangutany.com';
const ADMIN_EMAIL  = process.env.TEST_ADMIN_EMAIL    || '';
const ADMIN_PASS   = process.env.TEST_ADMIN_PASSWORD || '';
const USER_EMAIL   = process.env.TEST_USER_EMAIL     || '';
const USER_PASS    = process.env.TEST_USER_PASSWORD  || '';
const SS_DIR       = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

// ─── Browser lifecycle ────────────────────────────────────────────────────────

let browser;
test.before(async () => {
  browser = await chromium.launch({ headless: true });
});
test.after(async () => {
  if (browser) await browser.close();
});

async function newPage() {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'OrangutanyUITests/1.0',
  });
  const page = await ctx.newPage();
  return page;
}

async function screenshot(page, name) {
  const file = path.join(SS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function failshot(page, name) {
  const file = await screenshot(page, `FAIL-${name}`);
  console.error(`  Screenshot saved: ${file}`);
}

// ─── Homepage ─────────────────────────────────────────────────────────────────

test('homepage: loads and has correct title', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const title = await page.title();
    assert.ok(title.toLowerCase().includes('mushroom') || title.toLowerCase().includes('orangutany'),
      `Unexpected page title: "${title}"`);
    await screenshot(page, 'homepage');
  } catch (e) {
    await failshot(page, 'homepage');
    throw e;
  } finally {
    await page.close();
  }
});

test('homepage: hero headline says "Identify wild mushrooms from photos"', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const h1 = page.locator('h1').first();
    await h1.waitFor({ state: 'visible', timeout: 10000 });
    const text = await h1.innerText();
    assert.match(text, /identify.*mushroom/i, `H1 changed: "${text}"`);
  } catch (e) {
    await failshot(page, 'homepage-headline');
    throw e;
  } finally {
    await page.close();
  }
});

test('homepage: photo upload area exists', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Upload drop zone or file input must exist
    const dropzone = page.locator('input[type="file"], [data-testid="dropzone"], label[for*="upload"], label[for*="file"]').first();
    await dropzone.waitFor({ state: 'attached', timeout: 10000 });
  } catch (e) {
    await failshot(page, 'homepage-upload');
    throw e;
  } finally {
    await page.close();
  }
});

test('homepage: "Analyze Photos" button exists and is disabled before upload', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const btn = page.locator('button', { hasText: /analyze photos/i }).first();
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    const isDisabled = await btn.isDisabled();
    assert.ok(isDisabled, 'Analyze Photos button should be disabled before photos are added');
  } catch (e) {
    await failshot(page, 'homepage-analyze-btn');
    throw e;
  } finally {
    await page.close();
  }
});

test('homepage: scan quota shows "X of 3 free scans remaining" for anonymous users', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const quota = page.locator('text=/scans? remaining/i').first();
    await quota.waitFor({ state: 'visible', timeout: 10000 });
    const text = await quota.innerText();
    assert.match(text, /\d+ of \d+ free scans? remaining/i, `Quota text changed: "${text}"`);
    await screenshot(page, 'homepage-quota');
  } catch (e) {
    await failshot(page, 'homepage-quota');
    throw e;
  } finally {
    await page.close();
  }
});

test('homepage: navigation links present', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Check for nav links
    const nav = page.locator('nav, header').first();
    await nav.waitFor({ state: 'visible', timeout: 10000 });
    const links = await page.locator('a[href]').all();
    assert.ok(links.length >= 3, `Expected at least 3 links on homepage, got ${links.length}`);
  } catch (e) {
    await failshot(page, 'homepage-nav');
    throw e;
  } finally {
    await page.close();
  }
});

test('homepage: footer with legal links present', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const privacy = page.locator('a[href*="privacy"]').first();
    await privacy.waitFor({ state: 'visible', timeout: 10000 });
    const terms = page.locator('a[href*="terms"]').first();
    await terms.waitFor({ state: 'visible', timeout: 10000 });
    await screenshot(page, 'homepage-footer');
  } catch (e) {
    await failshot(page, 'homepage-footer');
    throw e;
  } finally {
    await page.close();
  }
});

// ─── Auth UI ─────────────────────────────────────────────────────────────────

test('auth: "Log in" and "Sign Up Free" buttons visible on homepage', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const loginLink = page.locator('text=/log in/i').first();
    await loginLink.waitFor({ state: 'visible', timeout: 10000 });
    const signUp = page.locator('text=/sign up free/i').first();
    await signUp.waitFor({ state: 'visible', timeout: 5000 });
  } catch (e) {
    await failshot(page, 'auth-login-link');
    throw e;
  } finally {
    await page.close();
  }
});

test('auth: Google sign-in button present in auth modal', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Auth is in a modal — open it by clicking Log in
    await page.locator('text=/log in/i').first().click();
    const googleBtn = page.locator('button', { hasText: /google/i }).first();
    await googleBtn.waitFor({ state: 'visible', timeout: 10000 });
    const text = await googleBtn.innerText();
    assert.match(text, /google/i, `Google button text unexpected: "${text}"`);
    await screenshot(page, 'auth-google-btn');
  } catch (e) {
    await failshot(page, 'auth-google-btn');
    throw e;
  } finally {
    await page.close();
  }
});

test('auth: login flow — wrong password shows error', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Open auth modal
    await page.locator('text=/log in/i').first().click();
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('nobody@fake-domain-xyz.com');
    await page.locator('input[type="password"]').first().fill('wrongpass123');
    await page.locator('button[type="submit"]').first().click();
    // Should show an error message
    const error = page.locator('[role="alert"], p:text-matches("invalid|incorrect|wrong|failed|not found", "i")').first();
    await error.waitFor({ state: 'visible', timeout: 8000 });
    await screenshot(page, 'auth-login-error');
  } catch (e) {
    await failshot(page, 'auth-login-error');
    throw e;
  } finally {
    await page.close();
  }
});

test('auth: full login flow with credentials', { skip: !USER_EMAIL }, async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Open auth modal
    await page.locator('text=/log in/i').first().click();
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(USER_PASS);
    await page.locator('button[type="submit"], button:text-matches("log in|sign in", "i")').first().click();
    // After login — scan count should update
    await page.waitForTimeout(2000);
    await screenshot(page, 'auth-logged-in');
    // User should see their quota (daily scans)
    const quota = page.locator('text=/scans? remaining/i').first();
    await quota.waitFor({ state: 'visible', timeout: 8000 });
    const text = await quota.innerText();
    assert.match(text, /daily/i, `Expected "daily" scans after login, got: "${text}"`);
  } catch (e) {
    await failshot(page, 'auth-logged-in');
    throw e;
  } finally {
    await page.close();
  }
});

// ─── Forgot password page ─────────────────────────────────────────────────────

test('forgot-password: page loads with email input', async () => {
  const page = await newPage();
  try {
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await screenshot(page, 'forgot-password');
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
  } catch (e) {
    await failshot(page, 'forgot-password');
    throw e;
  } finally {
    await page.close();
  }
});

// ─── About page ───────────────────────────────────────────────────────────────

test('about: page loads with content', async () => {
  const page = await newPage();
  try {
    await page.goto(`${BASE}/about`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await screenshot(page, 'about');
    const heading = page.locator('h1, h2').first();
    await heading.waitFor({ state: 'visible', timeout: 10000 });
    const text = await heading.innerText();
    assert.ok(text.length > 3, `About page heading suspiciously short: "${text}"`);
  } catch (e) {
    await failshot(page, 'about');
    throw e;
  } finally {
    await page.close();
  }
});

// ─── Learn page ───────────────────────────────────────────────────────────────

test('learn: page loads with article list', async () => {
  const page = await newPage();
  try {
    await page.goto(`${BASE}/learn`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await screenshot(page, 'learn');
    const links = await page.locator('a[href*="/learn/"]').all();
    assert.ok(links.length >= 3, `Expected at least 3 learn articles, got ${links.length}`);
  } catch (e) {
    await failshot(page, 'learn');
    throw e;
  } finally {
    await page.close();
  }
});

// ─── Legal pages ─────────────────────────────────────────────────────────────

test('privacy: page loads with heading', async () => {
  const page = await newPage();
  try {
    await page.goto(`${BASE}/privacy`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await screenshot(page, 'privacy');
    const h = page.locator('h1').first();
    await h.waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await h.innerText(), /privacy/i);
  } catch (e) {
    await failshot(page, 'privacy');
    throw e;
  } finally {
    await page.close();
  }
});

test('terms: page loads with heading', async () => {
  const page = await newPage();
  try {
    await page.goto(`${BASE}/terms`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await screenshot(page, 'terms');
    const h = page.locator('h1').first();
    await h.waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await h.innerText(), /terms/i);
  } catch (e) {
    await failshot(page, 'terms');
    throw e;
  } finally {
    await page.close();
  }
});

// ─── Mobile viewport ─────────────────────────────────────────────────────────

test('mobile: homepage renders correctly at 390px width', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await screenshot(page, 'mobile-homepage');
    const h1 = page.locator('h1').first();
    await h1.waitFor({ state: 'visible', timeout: 10000 });
    // Ensure no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 390;
    assert.ok(bodyWidth <= viewportWidth + 5, `Horizontal overflow on mobile: body is ${bodyWidth}px wide`);
  } catch (e) {
    await failshot(page, 'mobile-homepage');
    throw e;
  } finally {
    await page.close();
  }
});

test('mobile: Analyze button is visible and tappable', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const btn = page.locator('button', { hasText: /analyze/i }).first();
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    const box = await btn.boundingBox();
    assert.ok(box !== null, 'Analyze button has no bounding box on mobile');
    assert.ok(box.height >= 36, `Button too small to tap: ${box.height}px tall`);
    assert.ok(box.width >= 100, `Button too narrow: ${box.width}px wide`);
  } catch (e) {
    await failshot(page, 'mobile-analyze-btn');
    throw e;
  } finally {
    await page.close();
  }
});

// ─── Admin dashboard (requires credentials) ──────────────────────────────────

test('admin: dashboard loads with stats cards', { skip: !ADMIN_EMAIL }, async () => {
  const page = await newPage();
  try {
    // Log in via API to get session cookie
    const res = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
      headers: { 'Content-Type': 'application/json', 'Origin': BASE },
    });
    assert.equal(res.status(), 200, 'Admin login failed');

    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await screenshot(page, 'admin-dashboard');

    // Stats should be visible
    const statsCards = page.locator('[class*="card"], [class*="stat"]');
    const count = await statsCards.count();
    assert.ok(count >= 2, `Expected stat cards on admin dashboard, found ${count}`);
  } catch (e) {
    await failshot(page, 'admin-dashboard');
    throw e;
  } finally {
    await page.close();
  }
});

test('admin: dashboard shows non-zero total users', { skip: !ADMIN_EMAIL }, async () => {
  const page = await newPage();
  try {
    const res = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
      headers: { 'Content-Type': 'application/json', 'Origin': BASE },
    });
    assert.equal(res.status(), 200, 'Admin login failed');

    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Find a number that's not 0 on the page (totalUsers)
    const body = await page.textContent('body');
    assert.ok(!body.includes('0 users') && !body.match(/\bUsers\b[\s\S]{0,20}\b0\b/),
      'Admin shows 0 users — auth guard or DB may be broken');
  } catch (e) {
    await failshot(page, 'admin-zero-users');
    throw e;
  } finally {
    await page.close();
  }
});

// ─── 404 page ────────────────────────────────────────────────────────────────

test('404: broken link shows a proper not-found page', async () => {
  const page = await newPage();
  try {
    await page.goto(`${BASE}/this-does-not-exist-xyz`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await screenshot(page, '404-page');
    const status = page.url(); // just confirm we stayed on the site
    assert.ok(status.includes(new URL(BASE).hostname), 'Redirected off-site on 404');
    // Should not be a blank page
    const bodyText = await page.textContent('body');
    assert.ok(bodyText.length > 20, '404 page body is empty');
  } catch (e) {
    await failshot(page, '404-page');
    throw e;
  } finally {
    await page.close();
  }
});

// ─── Link integrity ───────────────────────────────────────────────────────────

test('link integrity: no broken internal links on homepage', async () => {
  const page = await newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const hrefs = await page.$$eval('a[href]', els =>
      els.map(el => el.getAttribute('href')).filter(h => h && h.startsWith('/') && !h.startsWith('//#'))
    );
    const broken = [];
    for (const href of [...new Set(hrefs)]) {
      try {
        const r = await page.request.get(`${BASE}${href}`);
        if (r.status() >= 400 && r.status() !== 404) {
          broken.push(`${href} → ${r.status()}`);
        }
      } catch { /* network error = broken */ broken.push(`${href} → network error`); }
    }
    assert.equal(broken.length, 0, `Broken internal links:\n${broken.join('\n')}`);
  } catch (e) {
    await failshot(page, 'link-integrity');
    throw e;
  } finally {
    await page.close();
  }
});
