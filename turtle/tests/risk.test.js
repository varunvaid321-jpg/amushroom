'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const risk = require('../lib/risk');
const { rankCandidates } = require('../lib/ranking');
const config = require('../config.json');

const EQUITY = 10000;

/** Benchmark bars: `drift` per bar compounding from 100 over `length` bars. */
function benchmark(length, drift, noise = 0) {
  const bars = [];
  let price = 100;
  for (let i = 0; i < length; i += 1) {
    price *= 1 + drift + (noise ? (i % 2 === 0 ? noise : -noise) : 0);
    bars.push({ t: String(i), o: price, h: price * 1.004, l: price * 0.996, c: price, v: 1e6 });
  }
  return bars;
}

function candidate(overrides = {}) {
  return {
    symbol: 'AAA',
    sector: 'Industrials',
    plannedRisk: 75,
    plannedNotional: 1500,
    ...overrides,
  };
}

function position(overrides = {}) {
  return {
    symbol: 'BBB',
    sector: 'Financials',
    shares: 20,
    avgPrice: 50,
    stop: 46,
    units: 1,
    ...overrides,
  };
}

test('regime is risk-on above the 200-day SMA', () => {
  const regime = risk.evaluateRegime(benchmark(300, 0.001), config);
  assert.equal(regime.known, true);
  assert.equal(regime.riskOn, true);
  assert.equal(regime.riskMultiplier, 1);
  assert.ok(regime.close > regime.sma200);
});

test('regime blocks new entries below the 200-day SMA', () => {
  const regime = risk.evaluateRegime(benchmark(300, -0.001), config);
  assert.equal(regime.riskOn, false);
  assert.equal(regime.riskMultiplier, 0);
  assert.match(regime.reasons[0], /below its 200-day SMA/);
});

test('regime reports unknown rather than guessing on short benchmark history', () => {
  const regime = risk.evaluateRegime(benchmark(50, 0.001), config);
  assert.equal(regime.known, false);
  assert.equal(regime.riskOn, false);
  assert.equal(regime.riskMultiplier, 0);
});

test('portfolioHeat sums distance to stop and ignores positions already in profit-lock', () => {
  const positions = [
    position({ symbol: 'BBB', shares: 20, stop: 46 }),
    position({ symbol: 'CCC', shares: 10, stop: 120 }),
  ];
  const heat = risk.portfolioHeat(positions, { BBB: 50, CCC: 110 }, EQUITY);

  // BBB: 20 * (50 - 46) = 80. CCC stop is above the market, so it adds nothing.
  assert.equal(heat.dollars, 80);
  assert.equal(heat.pct, 0.008);
});

test('capitalUsage reports deployed capital and the remaining cash buffer', () => {
  const usage = risk.capitalUsage([position({ shares: 20 })], { BBB: 50 }, EQUITY);
  assert.equal(usage.deployed, 1000);
  assert.equal(usage.cash, 9000);
  assert.equal(usage.cashPct, 0.9);
});

test('a clean candidate passes every governor', () => {
  const gate = risk.gateCandidate({
    candidate: candidate(),
    positions: [],
    priceBySymbol: {},
    returnsBySymbol: {},
    equity: EQUITY,
    regime: risk.evaluateRegime(benchmark(300, 0.001), config),
    config,
  });
  assert.equal(gate.allowed, true);
  assert.deepEqual(gate.blockers, []);
});

test('sector cap blocks a third position in the same sector', () => {
  const gate = risk.gateCandidate({
    candidate: candidate({ sector: 'Energy' }),
    positions: [
      position({ symbol: 'E1', sector: 'Energy' }),
      position({ symbol: 'E2', sector: 'Energy' }),
    ],
    priceBySymbol: { E1: 50, E2: 50 },
    returnsBySymbol: {},
    equity: EQUITY,
    regime: risk.evaluateRegime(benchmark(300, 0.001), config),
    config,
  });
  assert.equal(gate.allowed, false);
  assert.ok(gate.blockers.some((b) => b.includes('sector cap')));
});

test('portfolio heat cap blocks a candidate that would breach 6%', () => {
  // Five positions each carrying $110 of open risk = $550, plus a $75 candidate.
  const positions = [];
  const prices = {};
  for (let i = 0; i < 5; i += 1) {
    positions.push(position({ symbol: `H${i}`, sector: `S${i}`, shares: 110, stop: 49 }));
    prices[`H${i}`] = 50;
  }
  const gate = risk.gateCandidate({
    candidate: candidate({ plannedRisk: 75 }),
    positions,
    priceBySymbol: prices,
    returnsBySymbol: {},
    equity: EQUITY,
    regime: risk.evaluateRegime(benchmark(300, 0.001), config),
    config,
  });
  assert.equal(gate.allowed, false);
  assert.ok(gate.blockers.some((b) => b.includes('portfolio heat')));
});

test('cash buffer blocks a candidate that would leave under 15% cash', () => {
  const gate = risk.gateCandidate({
    candidate: candidate({ plannedNotional: 2400 }),
    positions: [position({ symbol: 'D1', sector: 'Tech', shares: 130, avgPrice: 50, stop: 49.9 })],
    priceBySymbol: { D1: 50 },
    returnsBySymbol: {},
    equity: EQUITY,
    regime: risk.evaluateRegime(benchmark(300, 0.001), config),
    config,
  });
  // Deployed 6500 + 2400 = 8900, leaving 11% cash.
  assert.equal(gate.allowed, false);
  assert.ok(gate.blockers.some((b) => b.includes('cash buffer')));
});

test('unit cap blocks a pyramid add beyond the maximum', () => {
  const gate = risk.gateCandidate({
    candidate: candidate({ symbol: 'BBB', sector: 'Financials' }),
    positions: [position({ symbol: 'BBB', units: 3 })],
    priceBySymbol: { BBB: 50 },
    returnsBySymbol: {},
    equity: EQUITY,
    regime: risk.evaluateRegime(benchmark(300, 0.001), config),
    config,
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.isPyramidAdd, true);
  assert.ok(gate.blockers.some((b) => b.includes('maximum 3 units')));
});

test('correlation blocks a near-duplicate name once heat passes the correlated ceiling', () => {
  const walk = [];
  for (let i = 0; i < 60; i += 1) walk.push(i % 3 === 0 ? 0.01 : -0.004);

  const gate = risk.gateCandidate({
    // Projected heat lands at 4.6% — above the 4% correlated-book ceiling but
    // still under the 6% overall cap, so correlation must be the only blocker.
    candidate: candidate({ symbol: 'AAA', plannedRisk: 450 }),
    positions: [position({ symbol: 'BBB', shares: 20, stop: 49.5 })],
    priceBySymbol: { BBB: 50 },
    returnsBySymbol: { AAA: walk, BBB: walk }, // identical series: rho = 1
    equity: EQUITY,
    regime: risk.evaluateRegime(benchmark(300, 0.001), config),
    config,
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.blockers.length, 1, `expected only the correlation blocker, got ${gate.blockers}`);
  assert.ok(gate.blockers[0].includes('correlation'));
});

test('gateCandidate reports every blocker rather than stopping at the first', () => {
  const gate = risk.gateCandidate({
    candidate: candidate({ sector: 'Energy', plannedNotional: 9000 }),
    positions: [
      position({ symbol: 'E1', sector: 'Energy' }),
      position({ symbol: 'E2', sector: 'Energy' }),
    ],
    priceBySymbol: { E1: 50, E2: 50 },
    returnsBySymbol: {},
    equity: EQUITY,
    regime: risk.evaluateRegime(benchmark(300, -0.001), config), // also risk-off
    config,
  });
  assert.equal(gate.allowed, false);
  assert.ok(gate.blockers.length >= 3, `expected several blockers, got ${gate.blockers.length}`);
});

test('ranking prefers the tighter breakout when other metrics match', () => {
  const base = {
    indicators: {
      closes: new Array(300).fill(0).map((_, i) => 100 * Math.pow(1.003, i)),
      er: new Array(300).fill(0.6),
      adx: new Array(300).fill(30),
      regression: new Array(300).fill({ slope: 0.003, r2: 0.9 }),
    },
    index: 299,
    snapshot: { avgDailyValue: 5e7 },
  };
  const ranked = rankCandidates(
    [
      { ...base, symbol: 'EXTENDED', entry: { extensionN: 2.5 } },
      { ...base, symbol: 'TIGHT', entry: { extensionN: 0.2 } },
    ],
    config
  );

  assert.equal(ranked[0].symbol, 'TIGHT');
  assert.ok(ranked[0].score > ranked[1].score);
  assert.ok(ranked[0].contributions.breakoutTightness.contribution > 0);
});

test('ranking survives a candidate with missing metrics', () => {
  const ranked = rankCandidates(
    [
      {
        symbol: 'SPARSE',
        indicators: { closes: [100, 101], er: [null, null], adx: [null, null], regression: [null, null] },
        index: 1,
        snapshot: null,
        entry: { extensionN: 0.5 },
      },
    ],
    config
  );
  assert.equal(ranked.length, 1);
  assert.ok(Number.isFinite(ranked[0].score));
});

test('ranking an empty candidate set returns an empty list', () => {
  assert.deepEqual(rankCandidates([], config), []);
});
