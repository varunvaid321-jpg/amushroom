'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sizing = require('../lib/sizing');
const config = require('../config.json');

const EQUITY = 10000; // risk budget per unit = 0.75% = $75

test('risk-bound sizing: share count comes from the 2N stop distance', () => {
  // N = 1.20 -> 2N = 2.40 -> floor(75 / 2.40) = 31 shares
  // notional cap = 25% of 10000 = 2500 -> floor(2500 / 50) = 50 shares
  const out = sizing.computeUnitSize({
    equity: EQUITY,
    price: 50,
    maxPrice: 50,
    n: 1.2,
    config,
  });
  assert.equal(out.feasible, true);
  assert.equal(out.sharesByRisk, 31);
  assert.equal(out.sharesByNotional, 50);
  assert.equal(out.shares, 31);
  assert.equal(out.binding, 'risk');
  assert.equal(out.notional, 1550);
  assert.equal(out.actualRisk, 74.4); // 31 * 2.40, at or under the $75 budget
  assert.ok(out.actualRisk <= out.riskBudget);
});

test('notional-bound sizing: the 25% cap overrides a large risk-based size', () => {
  // A very low-volatility name would otherwise size to 75 shares of a $200 stock.
  const out = sizing.computeUnitSize({
    equity: EQUITY,
    price: 200,
    maxPrice: 200,
    n: 0.5,
    config,
  });
  assert.equal(out.sharesByRisk, 75);
  assert.equal(out.sharesByNotional, 12); // floor(2500 / 200)
  assert.equal(out.shares, 12);
  assert.equal(out.binding, 'notional');
  assert.ok(out.notional <= EQUITY * config.risk.maxSingleNameNotionalPct);
});

test('rejects a name whose single share risks more than the unit budget', () => {
  // The real CSU.TO case: ~$3058 with N around $130 -> 2N = $260 against a $75 budget.
  const out = sizing.computeUnitSize({
    equity: EQUITY,
    price: 3058,
    maxPrice: 3058,
    n: 130,
    config,
  });
  assert.equal(out.feasible, false);
  assert.equal(out.shares, 0);
  assert.match(out.reason, /exceeds the \$75 per-unit budget/);
});

test('rejects a position below the minimum ticket value', () => {
  const out = sizing.computeUnitSize({
    equity: EQUITY,
    price: 5,
    maxPrice: 5,
    n: 5,
    config,
  });
  assert.equal(out.feasible, false);
  assert.match(out.reason, /below the \$300 minimum ticket/);
});

test('rejects when N is unavailable rather than defaulting to a size', () => {
  const out = sizing.computeUnitSize({ equity: EQUITY, price: 50, maxPrice: 50, n: 0, config });
  assert.equal(out.feasible, false);
  assert.equal(out.shares, 0);
  assert.match(out.reason, /ATR/);
});

test('halved risk multiplier halves the risk-based share count', () => {
  const full = sizing.computeUnitSize({ equity: EQUITY, price: 50, maxPrice: 50, n: 1.2, config });
  const halved = sizing.computeUnitSize({
    equity: EQUITY,
    price: 50,
    maxPrice: 50,
    n: 1.2,
    config,
    riskMultiplier: 0.5,
  });
  assert.equal(halved.sharesByRisk, Math.floor(full.sharesByRisk / 2));
});

test('sizing at maxPrice keeps the notional cap intact on a worst-case fill', () => {
  // Signal close 198, N = 4 -> max price 200. Sizing must use 200, not 198.
  const out = sizing.computeUnitSize({
    equity: EQUITY,
    price: 198,
    maxPrice: 200,
    n: 0.5,
    config,
  });
  assert.equal(out.sharesByNotional, 12); // floor(2500 / 200), not floor(2500 / 198) = 12
  assert.ok(out.shares * 200 <= EQUITY * config.risk.maxSingleNameNotionalPct);
});

test('maxEntryPrice caps the chase at half a unit of N above the signal close', () => {
  assert.equal(sizing.maxEntryPrice(100, 2), 101);
  assert.equal(sizing.maxEntryPrice(172.13, 0.55), 172.4); // rounds down to the tick
});

test('pyramidLadder spaces adds by 0.5N and stops at the unit cap', () => {
  const rungs = sizing.pyramidLadder(100, 2, config);
  assert.equal(rungs.length, config.risk.maxUnitsPerName - 1);
  assert.deepEqual(rungs, [
    { unit: 2, triggerPrice: 101 },
    { unit: 3, triggerPrice: 102 },
  ]);
});

test('computeStop anchors 2N below the fill before any profit accrues', () => {
  const out = sizing.computeStop({
    lastFillPrice: 100,
    highestCloseSinceEntry: 100,
    n: 2,
    previousStop: null,
    config,
  });
  assert.equal(out.stop, 96);
  assert.equal(out.source, 'fill-anchored');
});

test('computeStop ratchets up as the highest close advances', () => {
  const out = sizing.computeStop({
    lastFillPrice: 100,
    highestCloseSinceEntry: 110,
    n: 2,
    previousStop: 96,
    config,
  });
  assert.equal(out.stop, 106); // 110 - 2N
  assert.equal(out.source, 'chandelier-trail');
  assert.equal(out.ratcheted, true);
});

test('computeStop never lowers an existing stop', () => {
  // Price pulled back hard: the trail input now suggests 90, but the resting
  // stop is already 106. Lowering it would hand back locked profit.
  const out = sizing.computeStop({
    lastFillPrice: 100,
    highestCloseSinceEntry: 94,
    n: 2,
    previousStop: 106,
    config,
  });
  assert.equal(out.stop, 106);
  assert.equal(out.ratcheted, false);
});

test('stopLimitPair places the limit at the looser of 50bps or 0.5N below the stop', () => {
  // High-volatility name: 0.5N ($1.00) is wider than 50bps ($0.50).
  assert.deepEqual(sizing.stopLimitPair(100, 2), { stop: 100, limit: 99 });
  // Low-volatility name: 50bps is the wider of the two.
  assert.deepEqual(sizing.stopLimitPair(100, 0.4), { stop: 100, limit: 99.5 });
});

test('stopLimitPair always places the limit below the stop', () => {
  for (const [stop, n] of [[10, 0.1], [250.55, 6.2], [3.75, 0.02]]) {
    const pair = sizing.stopLimitPair(stop, n);
    assert.ok(pair.limit < pair.stop, `limit ${pair.limit} must sit below stop ${pair.stop}`);
  }
});

test('openRisk floors at zero once the stop is above the market', () => {
  const position = { symbol: 'X', shares: 10, stop: 96 };
  assert.equal(sizing.openRisk(position, 100), 40);
  assert.equal(sizing.openRisk(position, 96), 0);
  assert.equal(sizing.openRisk(position, 90), 0); // locked profit, not risk
});

test('rMultiple expresses P&L in units of initial risk', () => {
  assert.equal(
    sizing.rMultiple({ entryPrice: 100, exitPrice: 110, initialStop: 96, shares: 10 }),
    2.5
  );
  assert.equal(
    sizing.rMultiple({ entryPrice: 100, exitPrice: 96, initialStop: 96, shares: 10 }),
    -1
  );
  assert.equal(
    sizing.rMultiple({ entryPrice: 100, exitPrice: 110, initialStop: 100, shares: 10 }),
    null // zero risk distance is undefined, not infinite
  );
});

test('rMultiple measures a pyramided trade against the FIRST unit risk', () => {
  // Three units: first fill 100 (10 sh), blended average 101, 30 shares total.
  // Initial risk is the first unit only: (100 - 96) x 10 = $40.
  // P&L is (120 - 101) x 30 = $570, so R = 14.25.
  const r = sizing.rMultiple({
    entryPrice: 101,
    exitPrice: 120,
    initialStop: 96,
    shares: 30,
    firstFillPrice: 100,
    firstUnitShares: 10,
  });
  assert.ok(Math.abs(r - 14.25) < 1e-9);
});

test('the blended-entry basis would shrink R as a trade goes further in profit', () => {
  // Regression guard for the defect this convention replaced. Dividing by
  // (avgPrice - initialStop) inflates the divisor on every pyramid add, so the
  // same winning trade scores LOWER the more it is added to.
  const blended = (120 - 101) / (101 - 96); // 3.8
  const firstUnit = sizing.rMultiple({
    entryPrice: 101,
    exitPrice: 120,
    initialStop: 96,
    shares: 30,
    firstFillPrice: 100,
    firstUnitShares: 10,
  });
  assert.ok(
    firstUnit > blended,
    'a pyramided winner must not score below its single-unit equivalent'
  );
});

test('both conventions agree exactly on a single-unit trade', () => {
  const withHints = sizing.rMultiple({
    entryPrice: 100,
    exitPrice: 110,
    initialStop: 96,
    shares: 10,
    firstFillPrice: 100,
    firstUnitShares: 10,
  });
  const without = sizing.rMultiple({
    entryPrice: 100,
    exitPrice: 110,
    initialStop: 96,
    shares: 10,
  });
  assert.equal(withHints, without);
});
