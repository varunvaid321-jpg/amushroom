#!/usr/bin/env node
'use strict';

/**
 * The /turtle engine entrypoint.
 *
 * Reads the day's cached market data, runs the integrity ladder, applies the
 * rules, and emits the daily brief. All computation is deterministic: re-running
 * this against the same cache directory must produce byte-identical output,
 * which is what makes a past recommendation auditable.
 *
 * Fetching is the session's job. This script never touches the network.
 *
 * Usage:
 *   node turtle/scripts/run.js                 # newest cached session
 *   node turtle/scripts/run.js --date 2026-08-12
 *   node turtle/scripts/run.js --json
 */

const fs = require('node:fs');
const path = require('node:path');

const config = require('../config.json');
const integrity = require('../lib/integrity');
const signals = require('../lib/signals');
const sizing = require('../lib/sizing');
const riskLib = require('../lib/risk');
const { rankCandidates } = require('../lib/ranking');
const portfolioLib = require('../lib/portfolio');
const report = require('../lib/report');
const { projectPortfolio, conditionalExpectation } = require('../lib/montecarlo');

const ROOT = path.join(__dirname, '..');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

// Where portfolio state, caches and run records live. Overridable so tests can
// exercise the real entrypoint without touching live trading state.
const DATA_ROOT = arg('data-root') || ROOT;
const CACHE = path.join(DATA_ROOT, 'data', 'cache');

function latestCachedDate() {
  if (!fs.existsSync(CACHE)) return null;
  const dirs = fs
    .readdirSync(CACHE)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
}

function loadSectors() {
  const file = path.join(ROOT, 'universe', 'tsx-universe.json');
  if (!fs.existsSync(file)) return {};
  const universe = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Object.fromEntries(universe.symbols.map((s) => [s.symbol, s.sector]));
}

function loadBacktest() {
  const file = path.join(DATA_ROOT, 'data', 'backtest-latest.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function main() {
  const date = arg('date') || latestCachedDate();
  if (!date) {
    process.stderr.write(
      `No cached session found under ${CACHE}.\nRun /turtle to fetch and cache a session first.\n`
    );
    process.exit(1);
  }

  const dir = path.join(CACHE, date);
  if (!fs.existsSync(dir)) {
    process.stderr.write(`No cache directory for ${date}.\n`);
    process.exit(1);
  }

  const now = arg('now') ? new Date(arg('now')) : new Date();
  const sectorBySymbol = loadSectors();
  const state = portfolioLib.loadPortfolio(DATA_ROOT, config);
  const warnings = [];

  // ---- Integrity ---------------------------------------------------------
  const verified = {};
  const abstained = [];
  let minSourcesAgreed = Infinity;

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
    minSourcesAgreed = Math.min(minSourcesAgreed, result.sourcesAgreed);
  }

  // ---- Regime ------------------------------------------------------------
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
  const regime = riskLib.evaluateRegime(benchmarkBars, config);
  delete verified[benchmarkSymbol];

  // ---- Per-symbol indicators --------------------------------------------
  const indicatorsBySymbol = {};
  const lastIndex = {};
  const priceBySymbol = {};
  for (const [symbol, bars] of Object.entries(verified)) {
    indicatorsBySymbol[symbol] = signals.computeIndicators(bars, config);
    lastIndex[symbol] = bars.length - 1;
    priceBySymbol[symbol] = bars[bars.length - 1].c;
  }

  const equity =
    state.cash +
    state.positions.reduce(
      (sum, p) => sum + (priceBySymbol[p.symbol] ?? p.avgPrice) * p.shares,
      0
    );

  const actions = [];
  const noAction = [];

  // ---- Open positions: exits first, then stop maintenance ---------------
  for (const position of state.positions) {
    const bars = verified[position.symbol];
    if (!bars) {
      warnings.push(
        `${position.symbol} is an open position but was not verified this run — its stop was NOT re-evaluated. Leave the resting order in place.`
      );
      continue;
    }
    const i = lastIndex[position.symbol];
    const indicators = indicatorsBySymbol[position.symbol];
    const n = indicators.atr[i];
    const close = bars[i].c;

    const exit = signals.evaluateExit(bars, indicators, i, position, config);
    if (exit.triggered) {
      const riskPerShare = position.avgPrice - position.initialStop;
      actions.push({
        type: 'SELL',
        symbol: position.symbol,
        shares: position.shares,
        reason: exit.reason,
        r: riskPerShare > 0 ? (close - position.avgPrice) / riskPerShare : null,
        pnl: (close - position.avgPrice) * position.shares,
      });
      continue;
    }

    const highestClose = Math.max(position.highestClose, close);
    const next = sizing.computeStop({
      lastFillPrice: position.lastFillPrice,
      highestCloseSinceEntry: highestClose,
      n,
      previousStop: position.stop,
      config,
    });

    if (next.stop > position.stop + 1e-9) {
      const riskPerShare = position.avgPrice - position.initialStop;
      actions.push({
        type: 'RAISE_STOP',
        symbol: position.symbol,
        from: position.stop,
        to: next.stop,
        limit: sizing.stopLimitPair(next.stop, n).limit,
        source: next.source,
        lockedR: riskPerShare > 0 ? (next.stop - position.avgPrice) / riskPerShare : 0,
      });
    }
  }

  // ---- Entry candidates --------------------------------------------------
  const candidates = [];
  for (const [symbol, bars] of Object.entries(verified)) {
    const i = lastIndex[symbol];
    const indicators = indicatorsBySymbol[symbol];
    const position = state.positions.find((p) => p.symbol === symbol);

    if (position) {
      if (position.units >= config.risk.maxUnitsPerName) continue;
      const n = indicators.atr[i];
      if (!(n > 0)) continue;
      const trigger = position.lastFillPrice + config.risk.pyramidSpacingN * n;
      if (bars[i].c < trigger) continue;
      candidates.push({
        symbol,
        sector: position.sector,
        indicators,
        index: i,
        snapshot: null,
        entry: { system: position.system, n, extensionN: 0 },
        isAdd: true,
        unit: position.units + 1,
      });
      continue;
    }

    const entry = signals.evaluateEntry(bars, indicators, i, config, state.symbolState[symbol] || {});
    if (!entry.triggered) {
      if (entry.reason && entry.reason !== 'no breakout') {
        noAction.push({ symbol, reason: entry.reason });
      }
      continue;
    }

    const quality = signals.evaluateQuality(indicators, i, config);
    if (!quality.passed) {
      noAction.push({ symbol, reason: `breakout but ${quality.reasons.join(', ')}` });
      continue;
    }

    candidates.push({
      symbol,
      sector: sectorBySymbol[symbol] || 'Unknown',
      indicators,
      index: i,
      snapshot: null,
      entry,
      isAdd: false,
      unit: 1,
    });
  }

  // ---- Rank, gate, size --------------------------------------------------
  const backtest = loadBacktest();
  const historicalTrades = backtest && backtest.gatePassed ? backtest.trades : [];
  const simulated = state.positions.map((p) => ({ ...p }));

  for (const candidate of rankCandidates(candidates, config)) {
    const i = candidate.index;
    const bars = verified[candidate.symbol];
    const n = candidate.entry.n ?? candidate.indicators.atr[i];
    const maxPrice = sizing.maxEntryPrice(bars[i].c, n);

    const size = sizing.computeUnitSize({
      equity,
      price: bars[i].c,
      maxPrice,
      n,
      config,
      riskMultiplier: regime.riskMultiplier,
    });
    if (!size.feasible) {
      noAction.push({ symbol: candidate.symbol, reason: size.reason });
      continue;
    }

    const gate = riskLib.gateCandidate({
      candidate: {
        symbol: candidate.symbol,
        sector: candidate.sector,
        plannedRisk: size.actualRisk,
        plannedNotional: size.notional,
      },
      positions: simulated,
      priceBySymbol,
      returnsBySymbol: {},
      equity,
      regime,
      config,
    });
    if (!gate.allowed) {
      noAction.push({ symbol: candidate.symbol, reason: gate.blockers.join('; ') });
      continue;
    }

    const stopPair = sizing.stopLimitPair(
      sizing.computeStop({
        lastFillPrice: maxPrice,
        highestCloseSinceEntry: maxPrice,
        n,
        previousStop: null,
        config,
      }).stop,
      n
    );

    actions.push({
      type: candidate.isAdd ? 'ADD' : 'BUY',
      symbol: candidate.symbol,
      shares: size.shares,
      maxPrice,
      notional: size.notional,
      n,
      unit: candidate.unit,
      maxUnits: config.risk.maxUnitsPerName,
      system: candidate.entry.system,
      risk: size.actualRisk,
      riskPct: size.actualRisk / equity,
      stop: stopPair.stop,
      limit: stopPair.limit,
      nextAdd:
        candidate.unit < config.risk.maxUnitsPerName
          ? sizing.money(maxPrice + config.risk.pyramidSpacingN * n)
          : null,
      expectation: historicalTrades.length
        ? conditionalExpectation({
            trades: historicalTrades,
            system: candidate.entry.system,
            efficiencyRatio: candidate.indicators.er[i],
            adx: candidate.indicators.adx[i],
          })
        : { ok: false, reason: 'no validated backtest available yet' },
    });

    // Reserve the capital and heat this order would consume so the next
    // candidate is gated against the book as it WOULD be, not as it is now.
    simulated.push({
      symbol: candidate.symbol,
      sector: candidate.sector,
      shares: size.shares,
      avgPrice: maxPrice,
      stop: stopPair.stop,
      units: candidate.unit,
    });
    priceBySymbol[candidate.symbol] = maxPrice;
  }

  // ---- Assemble and emit -------------------------------------------------
  const heat = riskLib.portfolioHeat(state.positions, priceBySymbol, equity);
  const usage = riskLib.capitalUsage(state.positions, priceBySymbol, equity);

  if (backtest && !backtest.gatePassed) {
    warnings.push(
      'The latest walk-forward gate FAILED. Entry recommendations below are rule output, not validated edge — do not trade them until the gate passes.'
    );
  } else if (!backtest) {
    warnings.push(
      'No backtest has been run. Entry recommendations are unvalidated — run npm run turtle:backtest before trading live.'
    );
  }

  const decision = {
    date,
    equity: sizing.money(equity),
    deployed: usage.deployed,
    deployedPct: usage.deployedPct,
    heatPct: heat.pct,
    heatCapPct: config.risk.maxPortfolioHeatPct,
    sourcesAgreed: Number.isFinite(minSourcesAgreed) ? minSourcesAgreed : 0,
    regime: { ...regime, benchmarkSymbol },
    actions,
    noAction,
    abstained,
    warnings,
    forward:
      backtest && backtest.gatePassed
        ? projectPortfolio({ stats: backtest.stats, horizonDays: 60, config })
        : { ok: false, reason: 'no validated backtest to project from' },
  };

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
