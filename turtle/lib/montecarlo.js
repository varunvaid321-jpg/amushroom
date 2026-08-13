'use strict';

const { percentile } = require('./indicators');

/**
 * Forward projection by bootstrap resampling of backtested trade outcomes.
 *
 * This exists to answer "what should I expect?" with a distribution instead of
 * a number. A single expected return is the least useful honest answer to that
 * question: the whole character of trend following is that the median outcome
 * and the mean outcome are far apart, and the path between them includes
 * drawdowns that feel like failure while the system is working correctly.
 *
 * Resampling trade R-multiples with replacement deliberately destroys their
 * ORDER while preserving their DISTRIBUTION. That is the point — it answers
 * "what could this edge have produced?" rather than replaying the one sequence
 * that happened to occur.
 */

/**
 * Deterministic PRNG (mulberry32). Seeded so a given run always projects the
 * same numbers — a forecast that changes when you re-read it is not auditable.
 */
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulate `paths` independent sequences of `tradeCount` trades.
 *
 * Each trade risks a fixed fraction of CURRENT equity, so the compounding is
 * geometric and a run of losses shrinks subsequent bet sizes exactly as it
 * would in the live account.
 */
function bootstrapPaths({
  rMultiples,
  tradeCount,
  riskPerTrade,
  paths = 10000,
  seed = 20260812,
  drawdownThresholds = [0.1, 0.2],
}) {
  if (!rMultiples || rMultiples.length === 0) {
    return { ok: false, reason: 'no trade history to resample' };
  }
  if (tradeCount <= 0) {
    return { ok: false, reason: 'projection horizon contains no expected trades' };
  }

  const rng = makeRng(seed);
  const finals = [];
  const maxDrawdowns = [];
  let ruinCount = 0;

  for (let p = 0; p < paths; p += 1) {
    let equity = 1;
    let peak = 1;
    let worstDd = 0;

    for (let t = 0; t < tradeCount; t += 1) {
      const r = rMultiples[Math.floor(rng() * rMultiples.length)];
      equity *= 1 + r * riskPerTrade;
      if (equity <= 0) {
        equity = 0;
        break;
      }
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > worstDd) worstDd = dd;
    }

    finals.push(equity - 1);
    maxDrawdowns.push(worstDd);
    if (equity < 0.5) ruinCount += 1;
  }

  const probabilityOfDrawdown = {};
  for (const threshold of drawdownThresholds) {
    probabilityOfDrawdown[threshold] =
      maxDrawdowns.filter((d) => d > threshold).length / paths;
  }

  return {
    ok: true,
    paths,
    tradeCount,
    riskPerTrade,
    returnPercentiles: {
      p5: percentile(finals, 0.05),
      p25: percentile(finals, 0.25),
      p50: percentile(finals, 0.5),
      p75: percentile(finals, 0.75),
      p95: percentile(finals, 0.95),
    },
    drawdownPercentiles: {
      p50: percentile(maxDrawdowns, 0.5),
      p90: percentile(maxDrawdowns, 0.9),
      p99: percentile(maxDrawdowns, 0.99),
    },
    probabilityOfDrawdown,
    probabilityOfLoss: finals.filter((f) => f < 0).length / paths,
    probabilityOfHalving: ruinCount / paths,
  };
}

/**
 * Project the portfolio forward over a horizon in trading days.
 *
 * Trade frequency is measured from the backtest rather than assumed: sessions
 * divided by trades gives the observed arrival rate, which already reflects how
 * often the regime filter and risk caps suppress entries.
 */
function projectPortfolio({ stats, horizonDays = 60, config, seed }) {
  if (!stats || stats.tradeCount === 0) {
    return { ok: false, reason: 'backtest produced no closed trades to project from' };
  }

  const tradesPerSession = stats.tradeCount / Math.max(1, stats.sessions);
  const expectedTrades = Math.round(tradesPerSession * horizonDays);

  const projection = bootstrapPaths({
    rMultiples: stats.rMultiples,
    tradeCount: expectedTrades,
    riskPerTrade: config.risk.riskPerUnitPct,
    seed,
  });

  return {
    ...projection,
    horizonDays,
    expectedTrades,
    medianHoldWinners: stats.medianHoldWinners,
    medianHoldLosers: stats.medianHoldLosers,
  };
}

/**
 * Conditional expectations for a single prospective trade.
 *
 * Rather than quote the book-wide average to every candidate, this filters the
 * historical trade set to analogues — same entry system, comparable trend
 * quality — and reports what happened to those. When too few analogues exist the
 * function says so instead of quoting a statistic built on four samples.
 */
function conditionalExpectation({ trades, system, efficiencyRatio, adx, minSample = 20 }) {
  const erBand = 0.1;
  const adxBand = 10;

  let pool = trades.filter((t) => t.r !== null && t.system === system);
  const systemPool = pool.length;

  if (Number.isFinite(efficiencyRatio)) {
    const narrowed = pool.filter(
      (t) =>
        Number.isFinite(t.entryEfficiencyRatio) &&
        Math.abs(t.entryEfficiencyRatio - efficiencyRatio) <= erBand
    );
    if (narrowed.length >= minSample) pool = narrowed;
  }
  if (Number.isFinite(adx)) {
    const narrowed = pool.filter(
      (t) => Number.isFinite(t.entryAdx) && Math.abs(t.entryAdx - adx) <= adxBand
    );
    if (narrowed.length >= minSample) pool = narrowed;
  }

  if (pool.length < minSample) {
    return {
      ok: false,
      sample: pool.length,
      systemPool,
      reason: `only ${pool.length} historical analogues, ${minSample} required for a stable estimate`,
    };
  }

  const wins = pool.filter((t) => t.r > 0);
  const losers = pool.filter((t) => t.r <= 0);
  const holds = (arr) => {
    const sorted = arr.map((t) => t.holdingDays).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  };

  return {
    ok: true,
    sample: pool.length,
    winRate: wins.length / pool.length,
    expectedR: pool.reduce((acc, t) => acc + t.r, 0) / pool.length,
    medianHoldWinners: holds(wins),
    medianHoldLosers: holds(losers),
    probabilityReach2R: pool.filter((t) => t.maxFavorableR >= 2).length / pool.length,
    probabilityFullStop: pool.filter((t) => t.r <= -0.95).length / pool.length,
    rPercentiles: {
      p10: percentile(pool.map((t) => t.r), 0.1),
      p50: percentile(pool.map((t) => t.r), 0.5),
      p90: percentile(pool.map((t) => t.r), 0.9),
    },
  };
}

module.exports = {
  makeRng,
  bootstrapPaths,
  projectPortfolio,
  conditionalExpectation,
};
