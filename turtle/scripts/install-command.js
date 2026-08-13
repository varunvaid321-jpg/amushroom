#!/usr/bin/env node
'use strict';

/**
 * Install the /turtle slash command.
 *
 * The command template carries a {{TURTLE_DIR}} placeholder which is replaced
 * with this installation's absolute path. Without that, /turtle would only work
 * when Claude Code happened to be started from the right directory — and a
 * trading command that silently does nothing because you were in the wrong
 * folder is worse than one that does not exist.
 *
 *   --user   install to ~/.claude/commands (available in every directory)
 *   default  install to <repo>/.claude/commands
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TURTLE_DIR = path.resolve(path.join(__dirname, '..'));
const SOURCE = path.join(TURTLE_DIR, 'command', 'turtle.md');

function targetDir() {
  if (process.argv.includes('--user')) {
    return path.join(os.homedir(), '.claude', 'commands');
  }
  return path.join(TURTLE_DIR, '..', '.claude', 'commands');
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    process.stderr.write(`Canonical command missing at ${SOURCE}\n`);
    process.exit(1);
  }

  const rendered = fs.readFileSync(SOURCE, 'utf8').split('{{TURTLE_DIR}}').join(TURTLE_DIR);
  const dir = targetDir();
  const target = path.join(dir, 'turtle.md');

  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === rendered) {
    process.stdout.write(`/turtle is already up to date at ${target}\n`);
    return;
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, rendered);
  process.stdout.write(`Installed /turtle -> ${target}\n`);
  process.stdout.write(`  bound to ${TURTLE_DIR}\n`);
}

if (require.main === module) main();
