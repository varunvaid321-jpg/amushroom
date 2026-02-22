const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverPath = path.join(__dirname, '..', 'server.js');
const source = fs.readFileSync(serverPath, 'utf8');

test('server enforces same-origin checks for auth and identify POST endpoints', () => {
  assert.match(source, /\/api\/auth\/register'[\s\S]*requireSameOrigin/);
  assert.match(source, /\/api\/auth\/login'[\s\S]*requireSameOrigin/);
  assert.match(source, /\/api\/auth\/logout'[\s\S]*requireSameOrigin/);
  assert.match(source, /\/api\/identify'[\s\S]*requireSameOrigin/);
});

test('server sanitizes Google OAuth return path', () => {
  assert.match(source, /sanitizeReturnPath\(url\.searchParams\.get\('returnTo'\)/);
  assert.match(source, /sanitizeReturnPath\(stateValue\.returnTo/);
});
