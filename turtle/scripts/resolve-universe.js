#!/usr/bin/env node
'use strict';

/**
 * Resolve the curated TSX candidate list into verified IBKR contracts.
 *
 * This script does NOT call the network. MCP tools are available to the Claude
 * session, not to Node, so the session fetches `search_contracts` responses and
 * caches them; this script does the deterministic selection over that cache.
 * Keeping the two apart is what makes universe resolution reproducible and
 * testable rather than dependent on whatever the API returned that afternoon.
 *
 * Usage:
 *   node turtle/scripts/resolve-universe.js            # resolve from cache
 *   node turtle/scripts/resolve-universe.js --missing  # list tickers still to fetch
 */

const fs = require('node:fs');
const path = require('node:path');
const { buildUniverse, selectTseRow } = require('../lib/universe');

const ROOT = path.join(__dirname, '..');
const CANDIDATES = path.join(ROOT, 'universe', 'tsx-candidates.json');
const SEARCH_DIR = path.join(ROOT, 'data', 'cache', 'universe-search');
const OUTPUT = path.join(ROOT, 'universe', 'tsx-universe.json');

/** Dots are legal in TSX tickers but awkward in filenames. */
function cacheFileName(symbol) {
  return `${symbol.replace(/\./g, '_')}.json`;
}

function readCandidates() {
  return JSON.parse(fs.readFileSync(CANDIDATES, 'utf8')).candidates;
}

function readSearchResponse(symbol) {
  const file = path.join(SEARCH_DIR, cacheFileName(symbol));
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const candidates = readCandidates();
  const listMissing = process.argv.includes('--missing');

  const missing = candidates
    .filter((c) => readSearchResponse(c.symbol) === null)
    .map((c) => c.symbol);

  if (listMissing) {
    // Printed as JSON so the orchestrating session can consume it directly.
    process.stdout.write(JSON.stringify({ missing, count: missing.length }, null, 2) + '\n');
    return;
  }

  if (missing.length > 0) {
    process.stderr.write(
      `${missing.length} of ${candidates.length} candidates have no cached search response.\n` +
        `Fetch them with search_contracts and write each to ${SEARCH_DIR}/<SYMBOL>.json, ` +
        `then re-run. Run with --missing for the list.\n`
    );
  }

  const resolutions = candidates
    .filter((c) => readSearchResponse(c.symbol) !== null)
    .map((c) => ({
      symbol: c.symbol,
      name: c.name,
      sector: c.sector,
      result: selectTseRow(c.symbol, readSearchResponse(c.symbol)),
    }));

  if (resolutions.length === 0) {
    process.stderr.write('No cached search responses found — nothing to resolve.\n');
    process.exit(1);
  }

  const universe = buildUniverse(resolutions, {
    verifiedAt: new Date().toISOString().slice(0, 10),
  });

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(universe, null, 2) + '\n');

  process.stdout.write(
    `Resolved ${universe.counts.resolved} symbols, rejected ${universe.counts.rejected}.\n`
  );
  for (const [sector, count] of Object.entries(universe.counts.bySector).sort()) {
    process.stdout.write(`  ${sector.padEnd(24)} ${count}\n`);
  }
  if (universe.rejected.length > 0) {
    process.stdout.write('\nRejected:\n');
    for (const r of universe.rejected) {
      process.stdout.write(`  ${r.symbol.padEnd(10)} ${r.reason}\n`);
    }
  }
  process.stdout.write(`\nWrote ${OUTPUT}\n`);
}

if (require.main === module) main();

module.exports = { cacheFileName };
