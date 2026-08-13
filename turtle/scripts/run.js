#!/usr/bin/env node
'use strict';

/**
 * Decide from an IBKR multi-source cache.
 *
 * This is the path used when running inside Claude Code with the IBKR MCP server
 * attached: the session writes broker-grade responses to
 * data/cache/<date>/<SYMBOL>.json and this re-verifies and decides from them.
 *
 * For the standalone laptop path, use scripts/turtle.js, which fetches from
 * multiple public providers directly.
 *
 * Both entrypoints call the SAME lib/engine.js decide() function. Two separate
 * decision paths would eventually disagree, and a recommendation that cannot be
 * reproduced is worse than no recommendation.
 *
 * Usage:
 *   node turtle/scripts/run.js
 *   node turtle/scripts/run.js --date 2026-08-12 --json
 */

const fs = require('node:fs');
const path = require('node:path');

const config = require('../config.json');
const integrity = require('../lib/integrity');
const portfolioLib = require('../lib/portfolio');
const report = require('../lib/report');
const { decide } = require('../lib/engine');

const ROOT = path.join(__dirname, '..');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

const DATA_ROOT = arg('data-root') || ROOT;
const CACHE = path.join(DATA_ROOT, 'data', 'cache');

function latestCachedDate() {
  if (!fs.existsSync(CACHE)) return null;
  const dirs = fs.readdirSync(CACHE).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
}

/** Sector and currency for each symbol, from the candidate lists. */
function loadMeta() {
  const { loadCandidates } = require('../lib/universe');
  const meta = {};
  for (const entry of loadCandidates(ROOT, { fs, path })) {
    meta[entry.symbol] = { sector: entry.sector, currency: entry.currency };
  }
  return meta;
}

function loadBacktest() {
  const file = path.join(DATA_ROOT, 'data', 'backtest-latest.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function main() {
  const date = arg('date') || latestCachedDate();
  if (!date) {
    process.stderr.write(
      `No cached session found under ${CACHE}.\n` +
        `Use turtle/scripts/turtle.js to fetch data directly, or /turtle to cache an IBKR session.\n`
    );
    process.exit(1);
  }

  const dir = path.join(CACHE, date);
  if (!fs.existsSync(dir)) {
    process.stderr.write(`No cache directory for ${date}.\n`);
    process.exit(1);
  }

  const now = arg('now') ? new Date(arg('now')) : new Date();
  const state = portfolioLib.loadPortfolio(DATA_ROOT, config);
  const meta = loadMeta();
  const warnings = [];
  const abstained = [];
  const verified = {};
  const quorumBySymbol = {};

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const symbol = path.basename(file, '.json').replace(/_/g, '.');
    const sources = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const result = integrity.verifySymbol({ symbol, sources, now, config });

    if (!result.tradeable) {
      const failed = result.checks.filter((c) => !c.passed);
      abstained.push({ symbol, reason: failed.map((c) => `${c.name}: ${c.detail}`).join('; ') });
      continue;
    }
    if (result.verdict === integrity.VERDICT.WARN) {
      for (const check of result.checks.filter((c) => c.warning)) {
        warnings.push(`${symbol} — ${check.name}: ${check.detail}`);
      }
    }
    verified[symbol] = result.bars;
    quorumBySymbol[symbol] = result.sourcesAgreed;
  }

  const benchmarkSymbol = config.regime.benchmarkSymbol;
  const benchmarkBars = verified[benchmarkSymbol];
  if (!benchmarkBars) {
    process.stderr.write(
      `Benchmark ${benchmarkSymbol} did not pass integrity verification, so the market regime is unknown.\n` +
        `No recommendation is issued without it — that filter is the only thing preventing a long-only\n` +
        `system from riding a full index drawdown to the bottom.\n`
    );
    process.exit(1);
  }
  delete verified[benchmarkSymbol];

  const decision = decide({
    date,
    verified,
    benchmarkBars,
    state,
    meta,
    config,
    // This path serves CAD data from IBKR; US sizing requires turtle.js, which
    // fetches a live rate. Signalling 0 makes any USD candidate abstain loudly
    // rather than being silently sized at parity.
    fxRate: 0,
    backtest: loadBacktest(),
    abstained,
    warnings,
    quorumBySymbol,
  });

  portfolioLib.saveRun(DATA_ROOT, date, {
    decision,
    integrity: { verified: Object.keys(verified), abstained },
    generatedAt: new Date().toISOString(),
  });

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(decision, null, 2) + '\n');
  } else {
    process.stdout.write('\n' + report.render(decision) + '\n\n');
  }
}

if (require.main === module) main();
