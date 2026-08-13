#!/usr/bin/env node
'use strict';

/**
 * Run walk-forward validation and print the go/no-go gate.
 *
 * With --fetch it downloads ~5 years of history for the universe through the
 * provider layer and caches it; without, it runs against whatever is already
 * cached. Separating the two means a gate result can be reproduced months later
 * from exactly the bars that produced it.
 *
 * Usage:
 *   node turtle/scripts/backtest-cli.js --fetch     # download history, then run
 *   node turtle/scripts/backtest-cli.js              # run against cached bars
 *   node turtle/scripts/backtest-cli.js --json
 */

const fs = require('node:fs');
const path = require('node:path');
const { walkForward, evaluateGate, runBacktest } = require('../lib/backtest');
const { projectPortfolio } = require('../lib/montecarlo');
const { parseIbkrHistory, exchangeParts } = require('../lib/integrity');
const { fetchAll } = require('../lib/providers');
const { mapWithConcurrency } = require('../lib/http');
const { buildConsensus } = require('../lib/consensus');
const { loadCandidates } = require('../lib/universe');
const stability = require('../lib/stability');

const ROOT = path.join(__dirname, '..');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

// Overridable so a run can be pointed at an isolated data set without any risk
// of it being mistaken for the real bar cache later.
const DATA_ROOT = arg('data-root') || ROOT;
const BARS_DIR = path.join(DATA_ROOT, 'data', 'cache', 'bars');
const UNIVERSE = path.join(ROOT, 'universe', 'tsx-universe.json');
const config = require('../config.json');

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const num = (v) => (Number.isFinite(v) ? v.toFixed(2) : String(v));

/**
 * Download history for the whole universe and cache it.
 *
 * Bars are trimmed to sessions strictly BEFORE today's exchange date, so the
 * newest bar is always a settled one. Without that, a fetch run during market
 * hours would carry a still-forming bar into the backtest and every symbol
 * would abstain on the session gate.
 */
async function fetchHistory(markets) {
  const entries = loadCandidates(ROOT, { markets, fs, path });
  const benchmark = {
    symbol: config.regime.benchmarkSymbol,
    sector: 'Benchmark',
    currency: 'CAD',
    isBenchmark: true,
  };
  const all = [benchmark, ...entries.filter((e) => e.symbol !== benchmark.symbol)];
  const today = exchangeParts(new Date(), config.integrity.exchangeTimezone).date;

  process.stderr.write(`Fetching ~5y history for ${all.length} symbols across ${markets.join(', ')}...\n`);
  fs.mkdirSync(BARS_DIR, { recursive: true });

  let written = 0;
  let skipped = 0;

  const results = await mapWithConcurrency(all, config.providers.concurrency, async (entry) => {
    const fetched = await fetchAll(entry, {
      config,
      dataRoot: DATA_ROOT,
      days: 1825,
      timeoutMs: config.providers.timeoutMs,
    });

    const settled = fetched.sources.map((source) => ({
      ...source,
      bars: source.bars.filter(
        (bar) => exchangeParts(new Date(bar.t), config.integrity.exchangeTimezone).date < today
      ),
    }));

    const consensus = buildConsensus({
      symbol: entry.symbol,
      sources: settled,
      config,
      now: new Date(),
    });
    return { entry, consensus, failures: fetched.failures };
  });

  for (const result of results) {
    if (!result || !result.entry) continue;
    const { entry, consensus } = result;

    if (!consensus.tradeable) {
      skipped += 1;
      const reason = consensus.checks.filter((c) => !c.passed).map((c) => c.detail).join('; ');
      process.stderr.write(`  skip ${entry.symbol.padEnd(10)} ${reason}\n`);
      continue;
    }

    // The benchmark is an index, not a tradeable name, so it bypasses the
    // stability screen — but a universe name that fails it would only pollute
    // the backtest with trades the live system would never take.
    if (!entry.isBenchmark) {
      const screen = stability.screen(entry.symbol, consensus.bars, config);
      if (!screen.stable) {
        skipped += 1;
        process.stderr.write(`  skip ${entry.symbol.padEnd(10)} unstable: ${screen.failures[0]}\n`);
        continue;
      }
    }

    fs.writeFileSync(
      path.join(BARS_DIR, `${entry.symbol.replace(/\./g, '_')}.json`),
      JSON.stringify({ symbol: entry.symbol, currency: entry.currency, bars: consensus.bars })
    );
    written += 1;
  }

  process.stderr.write(`Cached ${written} symbols, skipped ${skipped}.\n\n`);
  return written;
}

/** Accept either the normalised {bars:[...]} shape or a raw IBKR response. */
function loadBars() {
  if (!fs.existsSync(BARS_DIR)) {
    process.stderr.write(
      `No cached bars at ${BARS_DIR}.\n` +
        `Run "npm run turtle:backtest -- --fetch" to download history first.\n`
    );
    process.exit(1);
  }

  const barsBySymbol = {};
  for (const file of fs.readdirSync(BARS_DIR).filter((f) => f.endsWith('.json'))) {
    const symbol = path.basename(file, '.json').replace(/_/g, '.');
    const raw = JSON.parse(fs.readFileSync(path.join(BARS_DIR, file), 'utf8'));
    try {
      barsBySymbol[symbol] = Array.isArray(raw.bars) ? raw.bars : parseIbkrHistory(raw);
    } catch (error) {
      process.stderr.write(`Skipping ${symbol}: ${error.message}\n`);
    }
  }
  return barsBySymbol;
}

/**
 * Sector map for the concentration cap.
 *
 * Falls back to the candidate lists when no IBKR-resolved universe file exists,
 * which is the normal case on a machine without a broker session. Returning an
 * empty map would silently disable the sector cap and let the backtest take
 * positions the live system would refuse — making the gate result meaningless.
 */
function loadSectors() {
  const sectors = {};
  for (const entry of loadCandidates(ROOT, { fs, path })) {
    sectors[entry.symbol] = entry.sector;
  }
  if (fs.existsSync(UNIVERSE)) {
    const universe = JSON.parse(fs.readFileSync(UNIVERSE, 'utf8'));
    for (const s of universe.symbols) sectors[s.symbol] = s.sector;
  }
  return sectors;
}

async function main() {
  const asJson = process.argv.includes('--json');
  const markets = (arg('markets') || 'CAD,USD').split(',').map((m) => m.trim().toUpperCase());

  if (process.argv.includes('--fetch')) {
    const written = await fetchHistory(markets);
    if (written === 0) {
      process.stderr.write(
        'No symbols could be cached. Run "npm run turtle:doctor" to check data source availability.\n'
      );
      process.exit(1);
    }
  }

  const all = loadBars();

  const benchmarkSymbol = config.regime.benchmarkSymbol;
  const benchmarkBars = all[benchmarkSymbol];
  if (!benchmarkBars) {
    process.stderr.write(
      `Benchmark ${benchmarkSymbol} is missing from the bar cache. The regime filter cannot be evaluated without it, and running without a regime filter is not an option this system offers.\n`
    );
    process.exit(1);
  }

  const barsBySymbol = { ...all };
  delete barsBySymbol[benchmarkSymbol];

  const sectorBySymbol = loadSectors();
  const folds = walkForward({ barsBySymbol, benchmarkBars, sectorBySymbol, config });
  const gate = evaluateGate(folds, config);

  const full = runBacktest({ barsBySymbol, benchmarkBars, sectorBySymbol, config });
  const projection = projectPortfolio({ stats: full.stats, horizonDays: 60, config });

  // The daily brief projects from this file. It records whether the gate passed
  // so the brief can refuse to show a forward view derived from a failed gate.
  fs.writeFileSync(
    path.join(DATA_ROOT, 'data', 'backtest-latest.json'),
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        gatePassed: gate.passed,
        symbolCount: Object.keys(barsBySymbol).length,
        stats: full.stats,
        trades: full.trades,
        folds: folds.map((f) => ({ fold: f.fold, fromDate: f.fromDate, toDate: f.toDate, stats: f.stats })),
      },
      null,
      2
    ) + '\n'
  );

  if (asJson) {
    process.stdout.write(
      JSON.stringify({ gate, folds: folds.map((f) => ({ ...f, trades: undefined })), full: { stats: full.stats }, projection }, null, 2) + '\n'
    );
    return;
  }

  const symbolCount = Object.keys(barsBySymbol).length;
  process.stdout.write(`\nTURTLE WALK-FORWARD — ${symbolCount} symbols, benchmark ${benchmarkSymbol}\n`);
  process.stdout.write('='.repeat(72) + '\n\n');

  for (const fold of folds) {
    const s = fold.stats;
    process.stdout.write(`Fold ${fold.fold}  ${fold.fromDate} → ${fold.toDate}\n`);
    process.stdout.write(
      `  trades ${String(s.tradeCount).padStart(4)}   win ${pct(s.winRate).padStart(6)}   ` +
        `expectancy ${num(s.expectancyR).padStart(6)}R   PF ${num(s.profitFactor).padStart(6)}   ` +
        `maxDD ${pct(s.maxDrawdownPct).padStart(6)}\n`
    );
    process.stdout.write(
      `  return ${pct(s.totalReturnPct).padStart(8)}   CAGR ${pct(s.cagrPct).padStart(7)}   ` +
        `median hold: winners ${s.medianHoldWinners}d, losers ${s.medianHoldLosers}d\n\n`
    );
  }

  process.stdout.write('-'.repeat(72) + '\n');
  process.stdout.write(`GATE: ${gate.passed ? 'PASS' : 'FAIL'}\n`);
  if (!gate.passed) {
    process.stdout.write('\nFailing criteria:\n');
    for (const c of gate.failed) {
      process.stdout.write(
        `  fold ${c.fold}  ${c.name.padEnd(14)} ${num(c.value).padStart(8)} vs required ${c.threshold}\n`
      );
    }
    process.stdout.write(
      '\nDo not trade this configuration live. A failing fold is the market\n' +
        'identifying a regime the rules do not survive — revise and revalidate.\n'
    );
  } else if (projection.ok) {
    const p = projection.returnPercentiles;
    process.stdout.write(
      `\nForward 60 sessions (${projection.paths} bootstrap paths, ~${projection.expectedTrades} trades):\n`
    );
    process.stdout.write(
      `  median ${pct(p.p50)}   25th ${pct(p.p25)}   75th ${pct(p.p75)}   ` +
        `5th ${pct(p.p5)}   95th ${pct(p.p95)}\n`
    );
    process.stdout.write(
      `  P(loss) ${pct(projection.probabilityOfLoss)}   ` +
        `P(drawdown >10%) ${pct(projection.probabilityOfDrawdown[0.1])}   ` +
        `P(drawdown >20%) ${pct(projection.probabilityOfDrawdown[0.2])}\n`
    );
    process.stdout.write(
      '\nThese are resampled from backtested outcomes, not a forecast. The order\n' +
        'of trades is randomised deliberately; only the distribution is meaningful.\n'
    );
  }
  process.stdout.write('\n');

  process.exitCode = gate.passed ? 0 : 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`backtest failed: ${error.stack}\n`);
    process.exitCode = 1;
  });
}
