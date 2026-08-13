'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseIbkrHistory } = require('../integrity');

/**
 * IBKR history read from the session cache.
 *
 * IBKR's MCP tools belong to the Claude session, not to Node, so this provider
 * cannot fetch. When `/turtle` runs inside Claude Code with the IBKR server
 * connected, the session writes raw responses here and they become an additional
 * independent source. Run standalone on a laptop with no session attached, the
 * directory is simply empty and this provider reports unavailable — which costs
 * one source and stops nothing.
 *
 * This is the only provider whose data is broker-grade consolidated tape, so
 * when it IS present it is a genuinely different kind of check on the free
 * endpoints rather than another copy of the same upstream.
 */

const NAME = 'ibkr-cache';

function cacheDir(dataRoot) {
  return path.join(dataRoot, 'data', 'cache', 'ibkr');
}

function fileFor(dataRoot, symbol) {
  return path.join(cacheDir(dataRoot), `${symbol.replace(/\./g, '_')}.json`);
}

/** How fresh the cached file is, in hours. Stale IBKR data must not silently vote. */
function ageHours(file) {
  return (Date.now() - fs.statSync(file).mtimeMs) / 3600000;
}

async function fetchDaily(entry, { dataRoot, maxAgeHours = 36 } = {}) {
  const file = fileFor(dataRoot, entry.symbol);
  if (!fs.existsSync(file)) {
    return { ok: false, provider: NAME, symbol: entry.symbol, error: 'no cached IBKR response' };
  }

  const age = ageHours(file);
  if (age > maxAgeHours) {
    return {
      ok: false,
      provider: NAME,
      symbol: entry.symbol,
      error: `cached IBKR response is ${age.toFixed(1)}h old, older than the ${maxAgeHours}h limit`,
    };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Accept either a bare history response or the multi-source envelope.
    const history = raw.primary || raw;
    const bars = parseIbkrHistory(history);
    if (bars.length === 0) {
      return { ok: false, provider: NAME, symbol: entry.symbol, error: 'cached response has no bars' };
    }
    return { ok: true, provider: NAME, symbol: entry.symbol, bars, ageHours: age };
  } catch (error) {
    return { ok: false, provider: NAME, symbol: entry.symbol, error: error.message };
  }
}

module.exports = { name: NAME, fileFor, cacheDir, fetchDaily, supports: () => true };
