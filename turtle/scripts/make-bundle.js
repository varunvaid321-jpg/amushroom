#!/usr/bin/env node
'use strict';

/**
 * Build a standalone turtle-trading bundle.
 *
 * The trading system shares a repository with an unrelated web app purely for
 * historical reasons. Nothing in it depends on that app, so the bundle is a
 * self-contained directory with its own package.json that runs anywhere Node 18+
 * is installed — no repository, no registry, no network install step.
 *
 * Usage: node turtle/scripts/make-bundle.js [outputDir]
 */

const fs = require('node:fs');
const path = require('node:path');

const TURTLE = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join('/tmp', 'turtle-bundle');
const DEST = path.join(OUT, 'turtle-trading');

// Source files only. Trading state, caches and run records are deliberately
// excluded: they are personal financial records and must not travel in a bundle.
const INCLUDE_DIRS = ['lib', 'scripts', 'universe', 'tests', 'command'];
const INCLUDE_FILES = ['config.json', 'README.md', 'SETUP.md'];
const EXCLUDE_SCRIPTS = new Set(['make-bundle.js']);

function copyDir(from, to, filter) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst, filter);
    else if (!filter || filter(entry.name)) fs.copyFileSync(src, dst);
  }
}

const PACKAGE = {
  name: 'turtle-trading',
  version: '1.0.0',
  private: true,
  description: 'Mechanical trend-following system for a CAD account on Wealthsimple',
  engines: { node: '>=18' },
  scripts: {
    turtle: 'node scripts/turtle.js',
    doctor: 'node scripts/doctor.js',
    backtest: 'node scripts/backtest-cli.js',
    'backtest:fetch': 'node scripts/backtest-cli.js --fetch',
    test: 'node --test tests/*.test.js',
    check:
      "for f in lib/*.js lib/providers/*.js scripts/*.js; do node --check \"$f\" || exit 1; done && echo 'turtle: syntax ok'",
    install_command: 'node scripts/install-command.js --user',
  },
};

const GITIGNORE = `# Live trading state and market data stay local.
data/
`;

function main() {
  fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });

  for (const dir of INCLUDE_DIRS) {
    const from = path.join(TURTLE, dir);
    if (!fs.existsSync(from)) continue;
    copyDir(from, path.join(DEST, dir), (name) => !EXCLUDE_SCRIPTS.has(name));
  }
  for (const file of INCLUDE_FILES) {
    const from = path.join(TURTLE, file);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(DEST, file));
  }

  fs.writeFileSync(path.join(DEST, 'package.json'), JSON.stringify(PACKAGE, null, 2) + '\n');
  fs.writeFileSync(path.join(DEST, '.gitignore'), GITIGNORE);
  fs.mkdirSync(path.join(DEST, 'data'), { recursive: true });

  let files = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else files += 1;
    }
  };
  walk(DEST);

  process.stdout.write(`Bundle written to ${DEST} (${files} files)\n`);
}

if (require.main === module) main();
