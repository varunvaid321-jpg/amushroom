const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeEmail, validateEmail, validatePassword, parseCookies } = require('../src/auth');
const { buildGoogleAuthUrl } = require('../src/google-oauth');

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
});

test('validateEmail enforces a valid format', () => {
  assert.equal(validateEmail('bad').valid, false);
  assert.equal(validateEmail('valid@example.com').valid, true);
});

test('validatePassword enforces baseline complexity', () => {
  assert.equal(validatePassword('short').valid, false);
  assert.equal(validatePassword('NoNumbersHere').valid, false);
  assert.equal(validatePassword('abc1234567').valid, true);
});

test('buildGoogleAuthUrl sets required query params', () => {
  const url = new URL(
    buildGoogleAuthUrl({
      clientId: 'client-id',
      redirectUri: 'https://amushroom.com/api/auth/google/callback',
      state: 'abc123'
    })
  );

  assert.equal(url.searchParams.get('client_id'), 'client-id');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://amushroom.com/api/auth/google/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'abc123');
});

test('parseCookies tolerates malformed encoded values', () => {
  const req = {
    headers: {
      cookie: 'good=value; bad=%E0%A4%A; safe=ok'
    }
  };

  const cookies = parseCookies(req);
  assert.equal(cookies.good, 'value');
  assert.equal(cookies.bad, '%E0%A4%A');
  assert.equal(cookies.safe, 'ok');
});
