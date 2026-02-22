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
    'public/styles/tokens.css',
    'public/styles/app.css',
    'public/scripts/app.js',
    'design/tokens/tokens.json',
    'backlog/README.md'
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
});

test('tokens are valid JSON with expected groups', () => {
  const tokens = JSON.parse(read('design/tokens/tokens.json'));
  assert.ok(tokens.color);
  assert.ok(tokens.typography);
  assert.ok(tokens.radius);
  assert.ok(tokens.space);
  assert.ok(tokens.shadow);
});
