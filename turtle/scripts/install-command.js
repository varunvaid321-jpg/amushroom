#!/usr/bin/env node
'use strict';

/**
 * Install the /turtle slash command into .claude/commands/.
 *
 * This repo gitignores .claude entirely, so a command written only there is lost
 * on a fresh clone. The canonical copy therefore lives in the committed tree at
 * turtle/command/turtle.md and this script copies it into place.
 *
 * Run after cloning, and again whenever turtle/command/turtle.md changes.
 */

const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.join(__dirname, '..', 'command', 'turtle.md');
const TARGET_DIR = path.join(__dirname, '..', '..', '.claude', 'commands');
const TARGET = path.join(TARGET_DIR, 'turtle.md');

function main() {
  if (!fs.existsSync(SOURCE)) {
    process.stderr.write(`Canonical command missing at ${SOURCE}\n`);
    process.exit(1);
  }

  const source = fs.readFileSync(SOURCE, 'utf8');
  const alreadyCurrent =
    fs.existsSync(TARGET) && fs.readFileSync(TARGET, 'utf8') === source;

  if (alreadyCurrent) {
    process.stdout.write('/turtle is already up to date.\n');
    return;
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.writeFileSync(TARGET, source);
  process.stdout.write(`Installed /turtle → ${TARGET}\n`);
}

if (require.main === module) main();
