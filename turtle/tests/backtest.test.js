'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const backtest = require('../lib/backtest');
const mc = require('../lib/montecarlo');
const config = require('../config.json');

/** Weekday session dates, ascending, starting 2024-01-01. */
function dates(count) {
  const out = [];
  const cursor = new Date('2024-01-01T00:00:00Z');
  while (out.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * A steadily trending series, clean enough to clear the quality gates.
 *
 * `drift` must exceed `spread`, otherwise the close can never clear the prior
 * bar's high and no Donchian breakout is possible — a degenerate series that
 * would silently produce zero trades and make every downstream assertion vacuous.
 */
function trendingBars(count, { start = 50, drift = 0.0035, spread = 0.0015 } = {}) {
  const ds = dates(count);
  const price = (i) => start * Math.pow(1 + drift, i) * (1 + 0.002 * Math.sin(i / 5));
  return ds.map((d, i) => {
    const c = price(i);
    return {
      t: `${d}T14:30:00Z`,
      o: i === 0 ? c : price(i - 1),
      h: Math.max(c, i === 0 ? c : price(i - 1)) * (1 + spread),
      l: Math.min(c, i === 0 ? c : price(i - 1)) * (1 - spread),
      c,
      v: 1000000,
    };
  });
}

/** A series that oscillates without going anywhere. */
function choppyBars(count, { start = 50 } = {}) {
  const ds = dates(count);
  return ds.map((d, i) => {
    const c = start * (1 + 0.05 * Math.sin(i / 3));
    return {
      t: `${d}T14:30:00Z`,
      o: c,
      h: c * 1.02,
      l: c * 0.98,
      c,
      v: 1000000,
    };
  });
}

const SECTORS = { AAA: 'Technology', BBB: 'Materials', CCC: 'Energy' };

test('applyCosts widens buys and shaves sells', () => {
  const buy = backtest.applyCosts(100, 'buy', config);
  const sell = backtest.applyCosts(100, 'sell', config);
  assert.ok(buy > 100 && sell < 100);
  assert.ok(Math.abs(buy - 100.1) < 1e-9); // 10bps total friction
  assert.ok(Math.abs(sell - 99.9) < 1e-9);
});

test('entries fill at the NEXT session open, never at the signal close', () => {
  // The single most important property of this backtester. If a signal
  // generated on a close could fill at that close, every reported return would
  // include money that cannot be earned.
  const bars = trendingBars(500);
  const result = backtest.runBacktest({
    barsBySymbol: { AAA: bars },
    benchmarkBars: trendingBars(500, { start: 100, drift: 0.001 }),
    sectorBySymbol: SECTORS,
    config,
  });

  assert.ok(result.trades.length > 0, 'expected at least one trade in a clean uptrend');
  const trade = result.trades[0];
  const entryBar = bars.find((b) => b.t.slice(0, 10) === trade.entryDate);

  assert.ok(entryBar, 'entry date must correspond to a real session');
  // firstFillPrice, not entryPrice: the latter blends in later pyramid units.
  const expected = backtest.applyCosts(entryBar.o, 'buy', config);
  assert.ok(
    Math.abs(trade.firstFillPrice - expected) < 1e-6,
    `entry filled at ${trade.firstFillPrice}, expected the next open ${expected}`
  );

  // And prove the negative directly: the fill must not equal the signal close.
  const signalIdx = bars.findIndex((b) => b.t.slice(0, 10) === trade.entryDate) - 1;
  assert.ok(
    Math.abs(trade.firstFillPrice - bars[signalIdx].c) > 1e-6,
    'a fill at the signal close would mean the backtester looked ahead'
  );
});

test('a gap above the maximum acceptable price cancels the order', () => {
  const bars = trendingBars(400);
  // Insert a violent overnight gap on a session late in the series.
  const gapIdx = 350;
  for (let i = gapIdx; i < bars.length; i += 1) {
    bars[i].o *= 1.35;
    bars[i].h *= 1.35;
    bars[i].l *= 1.35;
    bars[i].c *= 1.35;
  }

  const result = backtest.runBacktest({
    barsBySymbol: { AAA: bars },
    benchmarkBars: trendingBars(400, { start: 100, drift: 0.001 }),
    sectorBySymbol: SECTORS,
    config,
  });

  // No fill may occur on the gap session itself: its open is far beyond the
  // 0.5N cap set from the prior close.
  const gapDate = bars[gapIdx].t.slice(0, 10);
  assert.ok(
    !result.trades.some((t) => t.entryDate === gapDate),
    'an order must not fill through a gap beyond its maximum price'
  );
});

test('a clean uptrend produces positive expectancy', () => {
  const result = backtest.runBacktest({
    barsBySymbol: {
      AAA: trendingBars(600),
      BBB: trendingBars(600, { start: 30, drift: 0.003 }),
    },
    benchmarkBars: trendingBars(600, { start: 100, drift: 0.001 }),
    sectorBySymbol: SECTORS,
    config,
  });

  assert.ok(result.stats.tradeCount > 0);
  assert.ok(result.stats.expectancyR > 0, `expectancy was ${result.stats.expectancyR}`);
  assert.ok(result.stats.finalEquity > config.account.equity);
});

test('a choppy market is filtered out rather than traded repeatedly', () => {
  // The quality gates exist for exactly this series. Trend following should
  // decline to participate, not churn.
  const result = backtest.runBacktest({
    barsBySymbol: { AAA: choppyBars(600) },
    benchmarkBars: trendingBars(600, { start: 100, drift: 0.001 }),
    sectorBySymbol: SECTORS,
    config,
  });

  assert.ok(
    result.stats.tradeCount < 15,
    `expected few trades in chop, took ${result.stats.tradeCount}`
  );
});

test('no new entries are taken while the benchmark is below its 200-day SMA', () => {
  const result = backtest.runBacktest({
    barsBySymbol: { AAA: trendingBars(600) },
    benchmarkBars: trendingBars(600, { start: 100, drift: -0.0015 }),
    sectorBySymbol: SECTORS,
    config,
  });
  assert.equal(result.stats.tradeCount, 0, 'risk-off regime must suppress all entries');
});

test('equity curve records one point per session and never loses cash silently', () => {
  const result = backtest.runBacktest({
    barsBySymbol: { AAA: trendingBars(400) },
    benchmarkBars: trendingBars(400, { start: 100, drift: 0.001 }),
    sectorBySymbol: SECTORS,
    config,
  });
  assert.equal(result.equityCurve.length, 400);
  for (const point of result.equityCurve) {
    assert.ok(Number.isFinite(point.equity) && point.equity > 0);
    assert.ok(point.cash >= -1e-6, `cash went negative at ${point.date}`);
  }
});

test('maxDrawdown measures peak to trough', () => {
  const dd = backtest.maxDrawdown([
    { date: 'a', equity: 100 },
    { date: 'b', equity: 120 },
    { date: 'c', equity: 90 },
    { date: 'd', equity: 150 },
  ]);
  assert.ok(Math.abs(dd.pct - 0.25) < 1e-12); // (120 - 90) / 120
  assert.equal(dd.date, 'c');
});

test('summarise computes win rate, expectancy and profit factor exactly', () => {
  const trades = [
    { r: 2, pnl: 200, holdingDays: 40, symbol: 'A', maxFavorableR: 2 },
    { r: -1, pnl: -100, holdingDays: 10, symbol: 'B', maxFavorableR: 0.2 },
    { r: -1, pnl: -100, holdingDays: 12, symbol: 'C', maxFavorableR: 0.1 },
    { r: 4, pnl: 400, holdingDays: 80, symbol: 'D', maxFavorableR: 4 },
  ];
  const stats = backtest.summarise(trades, [{ date: 'x', equity: 10400 }], 10000);

  assert.equal(stats.tradeCount, 4);
  assert.equal(stats.winRate, 0.5);
  assert.equal(stats.expectancyR, 1); // (2 - 1 - 1 + 4) / 4
  assert.equal(stats.profitFactor, 3); // 600 / 200
  assert.equal(stats.medianHoldWinners, 60); // (40 + 80) / 2
  assert.equal(stats.medianHoldLosers, 11);
});

test('walkForward produces sequential, non-overlapping trading windows', () => {
  const folds = backtest.walkForward({
    barsBySymbol: { AAA: trendingBars(600) },
    benchmarkBars: trendingBars(600, { start: 100, drift: 0.001 }),
    sectorBySymbol: SECTORS,
    config,
  });

  assert.equal(folds.length, config.backtestGate.walkForwardFolds);
  for (let i = 1; i < folds.length; i += 1) {
    assert.ok(
      folds[i].fromDate > folds[i - 1].toDate,
      `fold ${i + 1} starts ${folds[i].fromDate} which overlaps fold ${i} ending ${folds[i - 1].toDate}`
    );
  }
});

test('the gate fails when a single fold fails', () => {
  const strong = { expectancyR: 0.5, profitFactor: 2, maxDrawdownPct: 0.1, tradeCount: 30 };
  const weak = { expectancyR: -0.2, profitFactor: 0.8, maxDrawdownPct: 0.4, tradeCount: 30 };

  const passing = backtest.evaluateGate(
    [{ fold: 1, stats: strong }, { fold: 2, stats: strong }],
    config
  );
  assert.equal(passing.passed, true);

  const failing = backtest.evaluateGate(
    [{ fold: 1, stats: strong }, { fold: 2, stats: weak }],
    config
  );
  assert.equal(failing.passed, false);
  assert.ok(failing.failed.every((c) => c.fold === 2));
  assert.ok(failing.failed.some((c) => c.name === 'maxDrawdown'));
});

test('the gate rejects a strategy with too few trades to measure', () => {
  const out = backtest.evaluateGate(
    [{ fold: 1, stats: { expectancyR: 3, profitFactor: 9, maxDrawdownPct: 0.01, tradeCount: 2 } }],
    config
  );
  assert.equal(out.passed, false);
  assert.ok(out.failed.some((c) => c.name === 'tradeCount'));
});

test('monte carlo is deterministic for a given seed', () => {
  const args = { rMultiples: [2, -1, -1, 4, -1, 3], tradeCount: 20, riskPerTrade: 0.0075, paths: 500 };
  const a = mc.bootstrapPaths({ ...args, seed: 42 });
  const b = mc.bootstrapPaths({ ...args, seed: 42 });
  const c = mc.bootstrapPaths({ ...args, seed: 43 });

  assert.deepEqual(a.returnPercentiles, b.returnPercentiles);
  assert.notDeepEqual(a.returnPercentiles, c.returnPercentiles);
});

test('monte carlo percentiles are ordered and drawdown probabilities are coherent', () => {
  const out = mc.bootstrapPaths({
    rMultiples: [2, -1, -1, 4, -1, 3, -1, 8, -1, -1],
    tradeCount: 50,
    riskPerTrade: 0.0075,
    paths: 2000,
    seed: 7,
  });

  const p = out.returnPercentiles;
  assert.ok(p.p5 <= p.p25 && p.p25 <= p.p50 && p.p50 <= p.p75 && p.p75 <= p.p95);
  assert.ok(out.probabilityOfDrawdown[0.1] >= out.probabilityOfDrawdown[0.2]);
  assert.ok(out.probabilityOfLoss >= 0 && out.probabilityOfLoss <= 1);
});

test('monte carlo refuses to project without trade history', () => {
  assert.equal(mc.bootstrapPaths({ rMultiples: [], tradeCount: 10, riskPerTrade: 0.01 }).ok, false);
  assert.equal(
    mc.bootstrapPaths({ rMultiples: [1], tradeCount: 0, riskPerTrade: 0.01 }).ok,
    false
  );
});

test('projectPortfolio derives trade frequency from the backtest, not an assumption', () => {
  const stats = {
    tradeCount: 40,
    sessions: 1000,
    rMultiples: [2, -1, -1, 3, -1],
    medianHoldWinners: 50,
    medianHoldLosers: 12,
  };
  const out = mc.projectPortfolio({ stats, horizonDays: 60, config, seed: 1 });

  assert.equal(out.expectedTrades, 2); // 40/1000 * 60 = 2.4 -> 2
  assert.equal(out.ok, true);
  assert.equal(out.medianHoldWinners, 50);
});

test('conditionalExpectation refuses to quote a statistic from too few analogues', () => {
  const trades = new Array(5).fill(null).map(() => ({
    r: 1,
    system: 2,
    holdingDays: 10,
    maxFavorableR: 1,
    entryEfficiencyRatio: 0.5,
    entryAdx: 25,
  }));
  const out = mc.conditionalExpectation({ trades, system: 2, efficiencyRatio: 0.5, adx: 25 });

  assert.equal(out.ok, false);
  assert.match(out.reason, /only 5 historical analogues/);
});

test('conditionalExpectation reports win rate and 2R probability from analogues', () => {
  const trades = [];
  for (let i = 0; i < 40; i += 1) {
    const winner = i % 4 === 0;
    trades.push({
      r: winner ? 3 : -1,
      system: 2,
      holdingDays: winner ? 60 : 12,
      maxFavorableR: winner ? 3 : 0.3,
      entryEfficiencyRatio: 0.5,
      entryAdx: 25,
    });
  }
  const out = mc.conditionalExpectation({ trades, system: 2, efficiencyRatio: 0.5, adx: 25 });

  assert.equal(out.ok, true);
  assert.equal(out.sample, 40);
  assert.equal(out.winRate, 0.25);
  assert.equal(out.expectedR, 0); // 0.25 * 3 + 0.75 * -1
  assert.equal(out.probabilityReach2R, 0.25);
  assert.equal(out.medianHoldWinners, 60);
});

test('conditionalExpectation falls back to the system pool when bands are too narrow', () => {
  const trades = [];
  for (let i = 0; i < 40; i += 1) {
    trades.push({
      r: i % 3 === 0 ? 2 : -1,
      system: 2,
      holdingDays: 20,
      maxFavorableR: 2,
      entryEfficiencyRatio: 0.9, // far from the queried band
      entryAdx: 60,
    });
  }
  const out = mc.conditionalExpectation({ trades, system: 2, efficiencyRatio: 0.31, adx: 21 });

  assert.equal(out.ok, true, 'should widen to the system pool rather than refuse');
  assert.equal(out.sample, 40);
});
