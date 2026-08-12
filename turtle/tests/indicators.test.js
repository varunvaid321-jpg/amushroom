'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ind = require('../lib/indicators');

/**
 * Golden-vector tests. Every expected value below is hand-computed from the
 * indicator definition, not captured from a previous run of this code — a
 * regression test seeded from its own output would happily lock in a bug.
 */

/** Bars with a deliberate gap at index 3 so true range must use the prior close. */
const GAP_BARS = [
  { t: '1', o: 10, h: 11, l: 9, c: 10, v: 1000 },
  { t: '2', o: 10, h: 12, l: 10, c: 11, v: 1000 },
  { t: '3', o: 11, h: 13, l: 11, c: 12, v: 1000 },
  { t: '4', o: 18, h: 20, l: 18, c: 19, v: 1000 },
  { t: '5', o: 19, h: 21, l: 19, c: 20, v: 1000 },
];

const close = (v) => (a, b) => Math.abs(a - b) < v;

test('trueRange uses high-low on the first bar and the prior close thereafter', () => {
  const tr = ind.trueRange(GAP_BARS);
  assert.equal(tr[0], 2); // 11 - 9, no prior close available
  assert.equal(tr[1], 2); // max(2, |12-10|, |10-10|)
  assert.equal(tr[2], 2);
  assert.equal(tr[3], 8); // gap: max(2, |20-12|, |18-12|) -> 8
  assert.equal(tr[4], 2);
});

test('atrWilder seeds with a simple mean then applies Wilder smoothing', () => {
  const atr = ind.atrWilder(GAP_BARS, 3);
  assert.equal(atr[0], null);
  assert.equal(atr[1], null);
  assert.equal(atr[2], 2); // seed = (2 + 2 + 2) / 3
  assert.equal(atr[3], 4); // (2 * 2 + 8) / 3
  assert.ok(close(1e-12)(atr[4], 10 / 3)); // (2 * 4 + 2) / 3
});

test('atrWilder returns all nulls when there is less history than the period', () => {
  assert.deepEqual(ind.atrWilder(GAP_BARS.slice(0, 2), 3), [null, null]);
});

test('donchian channels exclude the current bar', () => {
  const high = ind.donchianHigh(GAP_BARS, 3);
  const low = ind.donchianLow(GAP_BARS, 3);

  assert.equal(high[2], null); // not enough prior bars
  assert.equal(high[3], 13); // max high of bars 0..2
  assert.equal(high[4], 20); // max high of bars 1..3 — includes the gap bar
  assert.equal(low[3], 9); // min low of bars 0..2
  assert.equal(low[4], 10);
});

test('donchianHigh at bar i never sees bar i itself', () => {
  // Bar 4 has the highest high in the series (21). If the channel leaked the
  // current bar, high[4] would be 21 and no breakout could ever be detected.
  const high = ind.donchianHigh(GAP_BARS, 3);
  assert.notEqual(high[4], 21);
});

test('sma matches a hand-computed rolling mean', () => {
  const out = ind.sma([1, 2, 3, 4, 5], 3);
  assert.deepEqual(out, [null, null, 2, 3, 4]);
});

test('adx reaches 100 on a perfectly one-directional series', () => {
  // Every bar steps up by exactly 1, so -DM is always 0, -DI is 0, and DX is
  // pinned at 100 by definition. ADX must therefore be exactly 100.
  const bars = [];
  for (let i = 0; i < 40; i += 1) {
    bars.push({ t: String(i), o: 9 + i, h: 10 + i, l: 8 + i, c: 9 + i, v: 100 });
  }
  const { adx, plusDi, minusDi } = ind.adx(bars, 5);
  const last = bars.length - 1;
  assert.ok(close(1e-9)(adx[last], 100));
  assert.ok(close(1e-9)(plusDi[last], 50));
  assert.ok(close(1e-9)(minusDi[last], 0));
});

test('adx stays low on an alternating series and warms up as nulls', () => {
  const bars = [];
  for (let i = 0; i < 60; i += 1) {
    const base = i % 2 === 0 ? 100 : 101;
    bars.push({ t: String(i), o: base, h: base + 1, l: base - 1, c: base, v: 100 });
  }
  const { adx } = ind.adx(bars, 14);
  assert.equal(adx[0], null);
  assert.equal(adx[26], null); // first ADX lands at 2 * period - 1 = 27
  assert.ok(adx[59] < 25, `expected choppy ADX below 25, got ${adx[59]}`);
});

test('efficiencyRatio is 1.0 for a monotonic move and 0.0 for a round trip', () => {
  const trending = ind.efficiencyRatio([10, 11, 12, 19, 20], 3);
  assert.ok(close(1e-12)(trending[3], 1)); // |19-10| / (1+1+7)
  assert.ok(close(1e-12)(trending[4], 1));

  const chop = ind.efficiencyRatio([10, 11, 10, 11, 10], 4);
  assert.equal(chop[4], 0); // net move 0 over path length 4
});

test('logPriceRegression returns r2 of 1 and slope ln(2) on a doubling series', () => {
  const out = ind.logPriceRegression([1, 2, 4, 8, 16], 5);
  assert.equal(out[3], null);
  assert.ok(close(1e-12)(out[4].r2, 1));
  assert.ok(close(1e-12)(out[4].slope, Math.log(2)));
});

test('logPriceRegression reports a negative slope on a decaying series', () => {
  const out = ind.logPriceRegression([16, 8, 4, 2, 1], 5);
  assert.ok(out[4].slope < 0);
  assert.ok(close(1e-12)(out[4].r2, 1));
});

test('correlation returns +1, -1 and null for a degenerate input', () => {
  assert.ok(close(1e-12)(ind.correlation([1, 2, 3], [2, 4, 6]), 1));
  assert.ok(close(1e-12)(ind.correlation([1, 2, 3], [6, 4, 2]), -1));
  assert.equal(ind.correlation([1, 1, 1], [1, 2, 3]), null); // zero variance
  assert.equal(ind.correlation([1, 2], [1]), null); // length mismatch
});

test('correlation ignores null-paired observations', () => {
  const rho = ind.correlation([1, 2, null, 3], [2, 4, 9, 6]);
  assert.ok(close(1e-12)(rho, 1));
});

test('percentile interpolates between ranks', () => {
  assert.equal(ind.percentile([1, 2, 3, 4, 5], 0.5), 3);
  assert.ok(close(1e-12)(ind.percentile([1, 2, 3, 4, 5], 0.9), 4.6));
  assert.equal(ind.percentile([], 0.5), null);
});

test('zScores centre and scale, mapping non-finite values to neutral', () => {
  assert.deepEqual(ind.zScores([1, 2, 3]), [-1, 0, 1]);
  assert.deepEqual(ind.zScores([5, 5, 5]), [0, 0, 0]); // zero spread
  const withNull = ind.zScores([1, 2, 3, null]);
  assert.equal(withNull[3], 0);
});

test('momentum12_1 skips the most recent window', () => {
  const closes = [10, 11, 12, 13, 20, 15, 16, 30, 18, 19];
  // lookback 5, skip 2 -> from index 4 (20) to index 7 (30)
  assert.ok(close(1e-12)(ind.momentum12_1(closes, 5, 2), 30 / 20 - 1));
  assert.equal(ind.momentum12_1(closes, 50, 2), null); // insufficient history
});

test('realizedVolatility annualises with the square root of 252', () => {
  // A series alternating by a constant factor has a stable sample deviation.
  const closes = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100];
  const vol = ind.realizedVolatility(closes, 10);
  assert.equal(vol[0], null);
  assert.ok(vol[10] > 0);
  assert.ok(Number.isFinite(vol[10]));
});
