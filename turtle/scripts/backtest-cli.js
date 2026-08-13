#!/usr/bin/env node
'use strict';

/**
 * Run walk-forward validation and print the go/no-go gate.
 *
 * Reads cached IBKR history from turtle/data/cache/bars/. As with universe
 * resolution, fetching is the session's job and computation is this script's, so
 * a gate result can be reproduced months later from the same cached bars.
 *
 * Usage:
 *   node turtle/scripts/backtest-cli.js
 *   node turtle/scripts/backtest-cli.js --json
 */

const fs = require('node:fs');
const path = require('node:path');
const { walkForward, evaluateGate, runBacktest } = require('../lib/backtest');
const { projectPortfolio } = require('../lib/montecarlo');
const { parseIbkrHistory } = require('../lib/integrity');

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

function loadBars() {
  if (!fs.existsSync(BARS_DIR)) {
    process.stderr.write(
      `No cached bars at ${BARS_DIR}.\n` +
        `Run /turtle --backtest to fetch history for the universe first.\n`
    );
    process.exit(1);
  }

  const barsBySymbol = {};
  for (const file of fs.readdirSync(BARS_DIR).filter((f) => f.endsWith('.json'))) {
    const symbol = path.basename(file, '.json').replace(/_/g, '.');
    const raw = JSON.parse(fs.readFileSync(path.join(BARS_DIR, file), 'utf8'));
    try {
      barsBySymbol[symbol] = parseIbkrHistory(raw);
    } catch (error) {
      process.stderr.write(`Skipping ${symbol}: ${error.message}\n`);
    }
  }
  return barsBySymbol;
}

function loadSectors() {
  if (!fs.existsSync(UNIVERSE)) return {};
  const universe = JSON.parse(fs.readFileSync(UNIVERSE, 'utf8'));
  return Object.fromEntries(universe.symbols.map((s) => [s.symbol, s.sector]));
}

function main() {
  const asJson = process.argv.includes('--json');
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

if (require.main === module) main();
