#!/usr/bin/env node
'use strict';

/**
 * THE entrypoint. One command does everything: fetch, verify, screen, decide,
 * render, and persist the audit record.
 *
 * There is deliberately no step here that requires judgement. Every threshold
 * lives in config.json, every decision is made by tested code, and the output is
 * the same for the same inputs. Nothing about the recommendation depends on who
 * or what invoked it.
 *
 * Runs standalone on a laptop with nothing but Node 18+. No install, no keys, no
 * service.
 *
 * Usage:
 *   node turtle/scripts/turtle.js                  # daily run
 *   node turtle/scripts/turtle.js --full           # scan the entire universe
 *   node turtle/scripts/turtle.js --markets CAD    # restrict to one market
 *   node turtle/scripts/turtle.js --json
 *   node turtle/scripts/turtle.js --replay 2026-08-12   # re-decide from cache
 */

const fs = require('node:fs');
const path = require('node:path');

const config = require('../config.json');
const { fetchAll } = require('../lib/providers');
const { mapWithConcurrency } = require('../lib/http');
const { buildConsensus } = require('../lib/consensus');
const { loadCandidates } = require('../lib/universe');
const stability = require('../lib/stability');
const { fetchUsdCadRate } = require('../lib/fx');
const { decide } = require('../lib/engine');
const portfolioLib = require('../lib/portfolio');
const report = require('../lib/report');
const { exchangeParts } = require('../lib/integrity');

const ROOT = path.join(__dirname, '..');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 || !process.argv[i + 1] || process.argv[i + 1].startsWith('--')
    ? fallback
    : process.argv[i + 1];
}
const has = (name) => process.argv.includes(`--${name}`);

const DATA_ROOT = arg('data-root', ROOT);
const asJson = has('json');
const quiet = asJson || has('quiet');
const log = (s) => {
  if (!quiet) process.stderr.write(s);
};

function cacheDir(date) {
  return path.join(DATA_ROOT, 'data', 'cache', 'consensus', date);
}

function loadBacktest() {
  const file = path.join(DATA_ROOT, 'data', 'backtest-latest.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/**
 * Build the scan list.
 *
 * Open positions are ALWAYS included regardless of any screen or watchlist: a
 * position whose data is skipped is a position whose stop stops being managed,
 * which is the most dangerous thing this system could do quietly.
 */
function buildScanList(state, markets) {
  const candidates = loadCandidates(ROOT, { markets, fs, path });
  const benchmark = {
    symbol: config.regime.benchmarkSymbol,
    name: 'TSX benchmark',
    sector: 'Benchmark',
    currency: 'CAD',
    market: 'TSX',
    isBenchmark: true,
  };

  const bySymbol = new Map();
  bySymbol.set(benchmark.symbol, benchmark);
  for (const entry of candidates) if (!bySymbol.has(entry.symbol)) bySymbol.set(entry.symbol, entry);

  const held = new Set(state.positions.map((p) => p.symbol));
  const full = has('full');
  const watchlistFile = path.join(DATA_ROOT, 'data', 'watchlist.json');
  const watchlist = fs.existsSync(watchlistFile)
    ? new Set(JSON.parse(fs.readFileSync(watchlistFile, 'utf8')).symbols)
    : null;

  return [...bySymbol.values()].filter((entry) => {
    if (entry.isBenchmark || held.has(entry.symbol)) return true;
    if (full || !watchlist) return true;
    return watchlist.has(entry.symbol);
  });
}

async function main() {
  const started = Date.now();
  const markets = (arg('markets', 'CAD,USD') || 'CAD,USD').split(',').map((m) => m.trim().toUpperCase());
  const now = arg('now') ? new Date(arg('now')) : new Date();
  const replayDate = arg('replay');

  const state = portfolioLib.loadPortfolio(DATA_ROOT, config);
  const warnings = [];
  const abstained = [];
  const verified = {};
  const meta = {};
  const quorumBySymbol = {};

  const sessionDate = exchangeParts(now, config.integrity.exchangeTimezone).date;
  const date = replayDate || sessionDate;

  let scanned = 0;
  let unstable = 0;

  if (replayDate) {
    // ---- Replay: re-decide from a stored consensus snapshot ---------------
    const dir = cacheDir(replayDate);
    if (!fs.existsSync(dir)) {
      process.stderr.write(`No cached consensus for ${replayDate} at ${dir}\n`);
      process.exit(1);
    }
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const record = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      meta[record.symbol] = { sector: record.sector, currency: record.currency };
      if (record.tradeable) {
        verified[record.symbol] = record.bars;
        quorumBySymbol[record.symbol] = record.quorum;
      } else {
        abstained.push({ symbol: record.symbol, reason: record.reason });
      }
      scanned += 1;
    }
    log(`Replayed ${scanned} symbols from ${replayDate}\n`);
  } else {
    // ---- Live scan ---------------------------------------------------------
    const scanList = buildScanList(state, markets);
    log(`Scanning ${scanList.length} symbols across ${markets.join(', ')}...\n`);

    const results = await mapWithConcurrency(
      scanList,
      config.providers.concurrency,
      async (entry) => {
        const fetched = await fetchAll(entry, {
          config,
          dataRoot: DATA_ROOT,
          days: config.providers.historyDays,
          timeoutMs: config.providers.timeoutMs,
        });
        return { entry, fetched };
      }
    );

    fs.mkdirSync(cacheDir(date), { recursive: true });

    for (const result of results) {
      // A worker that failed outright still returns a result object; it must
      // never take the scan down with it.
      if (!result || !result.entry) continue;
      const { entry, fetched } = result;
      scanned += 1;
      meta[entry.symbol] = { sector: entry.sector, currency: entry.currency };

      const consensus = buildConsensus({
        symbol: entry.symbol,
        sources: fetched.sources,
        config,
        now,
      });

      let record = {
        symbol: entry.symbol,
        sector: entry.sector,
        currency: entry.currency,
        quorum: consensus.quorum,
        sourcesUsed: consensus.sourcesUsed,
        providerFailures: fetched.failures.map((f) => `${f.provider}: ${f.error}`),
        tradeable: false,
        reason: null,
        bars: null,
      };

      if (!consensus.tradeable) {
        const failed = consensus.checks.filter((c) => !c.passed);
        record.reason = failed.map((c) => `${c.name}: ${c.detail}`).join('; ');
        abstained.push({ symbol: entry.symbol, reason: record.reason });
      } else {
        // Stability screening applies to tradeable names but never to the
        // benchmark, which is an index and is not itself traded.
        const screen = entry.isBenchmark
          ? { stable: true, failures: [] }
          : stability.screen(entry.symbol, consensus.bars, config);

        if (!screen.stable) {
          unstable += 1;
          record.reason = `unstable: ${screen.failures.join('; ')}`;
          record.stability = screen.metrics;
          // Holding an unstable name is worse than not being told about it.
          if (state.positions.some((p) => p.symbol === entry.symbol)) {
            warnings.push(`${entry.symbol} is held but now fails stability: ${screen.failures.join('; ')}`);
            verified[entry.symbol] = consensus.bars;
            quorumBySymbol[entry.symbol] = consensus.quorum;
            record.tradeable = true;
            record.bars = consensus.bars;
          } else {
            abstained.push({ symbol: entry.symbol, reason: record.reason });
          }
        } else {
          verified[entry.symbol] = consensus.bars;
          quorumBySymbol[entry.symbol] = consensus.quorum;
          record.tradeable = true;
          record.bars = consensus.bars;
          record.stability = screen.metrics;
        }
      }

      fs.writeFileSync(
        path.join(cacheDir(date), `${entry.symbol.replace(/\./g, '_')}.json`),
        JSON.stringify(record)
      );
    }
    log(`Verified ${Object.keys(verified).length}, abstained ${abstained.length}, unstable ${unstable}\n`);
  }

  // ---- Benchmark is mandatory --------------------------------------------
  const benchmarkSymbol = config.regime.benchmarkSymbol;
  const benchmarkBars = verified[benchmarkSymbol];
  if (!benchmarkBars) {
    const why = abstained.find((a) => a.symbol === benchmarkSymbol);
    process.stderr.write(
      `\nBenchmark ${benchmarkSymbol} could not be verified${why ? ` — ${why.reason}` : ''}.\n` +
        `The market regime is unknown, so no recommendation is issued. That filter is the only\n` +
        `thing preventing a long-only system from riding a full index drawdown to the bottom.\n` +
        `Run "npm run turtle:doctor" to check data source availability.\n`
    );
    process.exit(1);
  }
  delete verified[benchmarkSymbol];

  // ---- FX ------------------------------------------------------------------
  let fxRate = 1;
  const needsFx = Object.keys(verified).some((s) => meta[s] && meta[s].currency === 'USD');
  if (needsFx) {
    const rate = await fetchUsdCadRate({ timeoutMs: config.providers.timeoutMs });
    if (rate.ok) {
      fxRate = rate.rate;
    } else {
      // US names simply drop out; CAD trading continues untouched.
      fxRate = 0;
      warnings.push(
        `No USD/CAD rate available (${rate.error}) — US positions cannot be sized this run. CAD trading is unaffected.`
      );
    }
  }

  const decision = decide({
    date,
    verified,
    benchmarkBars,
    state,
    meta,
    config,
    fxRate,
    backtest: loadBacktest(),
    abstained,
    warnings,
    quorumBySymbol,
  });

  decision.scanned = scanned;

  // Elapsed time deliberately does NOT go on the decision object: the decision
  // is the auditable artifact and must be byte-identical for identical inputs.
  // Wall-clock timing is diagnostics, so it goes to the log and the run record.
  const elapsedMs = Date.now() - started;
  log(`Completed in ${(elapsedMs / 1000).toFixed(1)}s\n`);

  portfolioLib.saveRun(DATA_ROOT, date, {
    decision,
    scanned,
    unstable,
    elapsedMs,
    verified: Object.keys(verified),
    generatedAt: new Date().toISOString(),
  });

  if (asJson) process.stdout.write(JSON.stringify(decision, null, 2) + '\n');
  else process.stdout.write('\n' + report.render(decision) + '\n\n');
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`\nturtle failed: ${error.stack}\n`);
    process.exitCode = 1;
  });
}
