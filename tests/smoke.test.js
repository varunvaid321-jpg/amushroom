const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('core production files exist', () => {
  const required = [
    'server.js',
    'public/index.html',
    'public/terms.html',
    'public/privacy.html',
    'public/refund.html',
    'public/robots.txt',
    'public/sitemap.xml',
    'public/styles/tokens.css',
    'public/styles/app.css',
    'public/styles/legal.css',
    'public/scripts/app.js',
    'design/tokens/tokens.json',
    'backlog/BACKLOG.md',
    'render.yaml',
    '.nvmrc'
  ];

  for (const file of required) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  }
});

test('index references modular css/js assets', () => {
  const html = read('public/index.html');
  assert.match(html, /\/styles\/tokens\.css/);
  assert.match(html, /\/styles\/app\.css/);
  assert.match(html, /\/scripts\/app\.js/);
  assert.match(html, /\/terms\.html/);
  assert.match(html, /\/privacy\.html/);
  assert.match(html, /\/refund\.html/);
});

test('tokens are valid JSON with expected groups', () => {
  const tokens = JSON.parse(read('design/tokens/tokens.json'));
  assert.ok(tokens.color);
  assert.ok(tokens.typography);
  assert.ok(tokens.radius);
  assert.ok(tokens.space);
  assert.ok(tokens.shadow);
});
