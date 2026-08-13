'use strict';

const yahoo = require('./yahoo');
const stooq = require('./stooq');
const ibkrCache = require('./ibkr-cache');

/**
 * Provider registry and the fallback fetch.
 *
 * The design rule: NO SINGLE PROVIDER CAN STOP A RUN. Every provider is queried
 * in parallel, all successes are collected, and the consensus layer decides what
 * to trust. A provider that is down, rate-limited, or does not carry a symbol
 * contributes nothing and costs nothing.
 *
 * Providers are queried in parallel rather than in a try-next-on-failure chain
 * because we do not want the FIRST answer — we want as many INDEPENDENT answers
 * as possible to compare. A fallback chain that stops at the first success would
 * give one unverified number, which is the failure mode this system exists to
 * prevent.
 */

const REGISTRY = { yahoo, stooq, 'ibkr-cache': ibkrCache };

function providersFor(config) {
  const enabled = config.providers && config.providers.enabled;
  const names = Array.isArray(enabled) ? enabled : Object.keys(REGISTRY);
  return names.map((name) => REGISTRY[name]).filter(Boolean);
}

/**
 * Fetch one symbol from every enabled provider.
 *
 * Always resolves. Returns `{ symbol, sources, failures, available }` where
 * `sources` is the list of successful `{ provider, bars }` results.
 */
async function fetchAll(entry, { config, dataRoot, days = 400, timeoutMs }) {
  const providers = providersFor(config).filter((p) => p.supports(entry));

  const settled = await Promise.all(
    providers.map(async (provider) => {
      try {
        return await provider.fetchDaily(entry, { dataRoot, days, timeoutMs });
      } catch (error) {
        // A provider throwing is a bug in that provider, never a run-stopper.
        return { ok: false, provider: provider.name, symbol: entry.symbol, error: error.message };
      }
    })
  );

  const sources = settled.filter((r) => r.ok);
  const failures = settled.filter((r) => !r.ok);

  return {
    symbol: entry.symbol,
    currency: entry.currency,
    sources,
    failures,
    available: sources.length,
  };
}

module.exports = { REGISTRY, providersFor, fetchAll };
