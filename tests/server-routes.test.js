const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverPath = path.join(__dirname, '..', 'server.js');
const source = fs.readFileSync(serverPath, 'utf8');

test('server includes auth and uploads routes', () => {
  const routes = [
    '/api/auth/config',
    '/api/auth/me',
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/google',
    '/api/auth/google/callback',
    '/api/user/uploads'
  ];

  for (const route of routes) {
    assert.match(source, new RegExp(route.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')));
  }
});
