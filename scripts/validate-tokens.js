const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const tokensPath = path.join(root, 'design', 'tokens', 'tokens.json');

function fail(message) {
  console.error(`[token-check] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(tokensPath)) {
  fail('Missing design/tokens/tokens.json');
}

let tokens;
try {
  tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
} catch {
  fail('tokens.json is not valid JSON');
}

const requiredPaths = [
  ['color', 'brand', 'primary'],
  ['color', 'surface', 'app'],
  ['color', 'text', 'primary'],
  ['typography', 'fontFamily', 'body'],
  ['radius', 'md'],
  ['space', '4']
];

for (const segments of requiredPaths) {
  let current = tokens;
  for (const segment of segments) {
    current = current?.[segment];
  }
  if (current === undefined || current === null || current === '') {
    fail(`Missing required token path: ${segments.join('.')}`);
  }
}

console.log('[token-check] tokens.json structure is valid');
