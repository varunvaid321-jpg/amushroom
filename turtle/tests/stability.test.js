'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const stability = require('../lib/stability');
const fx = require('../lib/fx');
const config = require('../config.json');

/** A well-behaved liquid name: steady drift, tight ranges, deep volume. */
function stableBars(count = 500, { start = 50, drift = 0.0004, price = null } = {}) {
  const bars = [];
  for (let i = 0; i < count; i += 1) {
    const c = (price ?? start) * Math.pow(1 + drift, i) * (1 + 0.003 * Math.sin(i / 7));
    const o = i === 0 ? c : bars[i - 1].c;
    bars.push({
      t: `2026-01-01T14:30:00.000Z`,
      o,
      h: Math.max(o, c) * 1.004,
      l: Math.min(o, c) * 0.996,
      c,
      v: 400000,
    });
  }
  return bars;
}

test('a liquid, steady name passes every check', () => {
  const out = stability.screen('GOOD', stableBars(), config);
  assert.equal(out.stable, true, `unexpected failures: ${out.failures.join('; ')}`);
  assert.ok(out.metrics.stabilityScore > 0);
});

test('a name with too little history is rejected as uncharacterised', () => {
  const out = stability.screen('NEW', stableBars(120), config);
  assert.equal(out.stable, false);
  assert.ok(out.failures.some((f) => f.includes('too new to characterise')));
});

test('a penny stock is rejected on the price floor', () => {
  const out = stability.screen('PENNY', stableBars(500, { start: 1.2 }), config);
  assert.equal(out.stable, false);
  assert.ok(out.failures.some((f) => f.includes('below the 5 floor')));
});

test('a wildly volatile name is rejected on the volatility ceiling', () => {
  const bars = stableBars(500);
  // Inject large alternating swings across the measurement window.
  for (let i = 250; i < bars.length; i += 1) {
    const shock = i % 2 === 0 ? 1.09 : 0.92;
    bars[i].c = bars[i - 1].c * shock;
    bars[i].o = bars[i - 1].c;
    bars[i].h = Math.max(bars[i].o, bars[i].c) * 1.01;
    bars[i].l = Math.min(bars[i].o, bars[i].c) * 0.99;
  }
  const out = stability.screen('WILD', bars, config);
  assert.equal(out.stable, false);
  assert.ok(out.failures.some((f) => f.includes('annualised volatility')));
});

test('a habitual gapper is rejected because stops cannot be relied on', () => {
  // This is the core reason the screen exists: a 2N stop is meaningless on a
  // stock that routinely opens through it.
  const bars = stableBars(500);
  for (let i = 260; i < bars.length; i += 12) {
    bars[i].o = bars[i - 1].c * 1.09;
    bars[i].c = bars[i].o * 1.001;
    bars[i].h = Math.max(bars[i].o, bars[i].c) * 1.005;
    bars[i].l = Math.min(bars[i].o, bars[i].c) * 0.995;
  }
  const out = stability.screen('GAPPY', bars, config);
  assert.equal(out.stable, false);
  assert.ok(out.failures.some((f) => f.includes('stops cannot be relied on')));
});

test('a single catastrophic day is rejected on the max-move limit', () => {
  const bars = stableBars(500);
  const i = 400;
  bars[i].c = bars[i - 1].c * 0.6;
  bars[i].o = bars[i - 1].c * 0.98;
  bars[i].h = bars[i].o * 1.001;
  bars[i].l = bars[i].c * 0.99;

  const out = stability.screen('CRASH', bars, config);
  assert.equal(out.stable, false);
  assert.ok(out.failures.some((f) => f.includes('largest single-day move')));
});

test('an illiquid name is rejected on median dollar volume', () => {
  const bars = stableBars(500);
  for (const bar of bars) bar.v = 500;
  const out = stability.screen('THIN', bars, config);
  assert.equal(out.stable, false);
  assert.ok(out.failures.some((f) => f.includes('liquidity floor')));
});

test('a halted session is rejected on zero volume', () => {
  const bars = stableBars(500);
  bars[480].v = 0;
  const out = stability.screen('HALT', bars, config);
  assert.equal(out.stable, false);
  assert.ok(out.failures.some((f) => f.includes('no volume')));
});

test('a stale price feed is caught by the flat-run check', () => {
  const bars = stableBars(500);
  for (let i = 470; i < 480; i += 1) {
    bars[i].c = bars[469].c;
    bars[i].o = bars[469].c;
    bars[i].h = bars[469].c * 1.001;
    bars[i].l = bars[469].c * 0.999;
  }
  const out = stability.screen('STALE', bars, config);
  assert.equal(out.stable, false);
  assert.ok(out.failures.some((f) => f.includes('price feed may be stale')));
});

test('every failing check is reported, not just the first', () => {
  const bars = stableBars(500, { start: 2 });
  for (const bar of bars) bar.v = 100;
  const out = stability.screen('BAD', bars, config);
  assert.ok(out.failures.length >= 2, `expected several failures, got ${out.failures}`);
});

test('no bars is a rejection, never a pass', () => {
  assert.equal(stability.screen('NONE', [], config).stable, false);
  assert.equal(stability.screen('NONE', null, config).stable, false);
});

test('gapFrequency and maxDailyMove measure what they claim', () => {
  const bars = [
    { o: 100, h: 101, l: 99, c: 100, v: 1 },
    { o: 100, h: 101, l: 99, c: 100, v: 1 },
    { o: 110, h: 111, l: 109, c: 110, v: 1 }, // 10% gap and 10% close move
  ];
  assert.ok(Math.abs(stability.gapFrequency(bars, 0.05) - 0.5) < 1e-12);
  assert.ok(Math.abs(stability.maxDailyMove(bars) - 0.1) < 1e-12);
});

// ---- FX ------------------------------------------------------------------

test('a CAD name in a CAD account carries no FX cost', () => {
  assert.equal(fx.roundTripCostPct('CAD', config), 0);
  assert.equal(fx.fxDragR({ price: 100, n: 2, currency: 'CAD', config }), 0);
});

test('a USD name costs a round trip without a USD account', () => {
  assert.ok(Math.abs(fx.roundTripCostPct('USD', config) - 0.03) < 1e-12);
});

test('a USD account converts once, not per trade', () => {
  const usdConfig = { ...config, fx: { ...config.fx, usdAccount: true } };
  assert.ok(Math.abs(fx.roundTripCostPct('USD', usdConfig) - 0.015) < 1e-12);
});

test('FX drag is expressed in R against the trade own risk', () => {
  // 3% round trip on a $100 stock with a $8 (2N) stop = $3 / $8 = 0.375R.
  const drag = fx.fxDragR({ price: 100, n: 4, currency: 'USD', config });
  assert.ok(Math.abs(drag - 0.375) < 1e-12);
});

test('a wide-stop USD name suffers less FX drag than a tight-stop one', () => {
  // The same currency cost matters far less when more risk is being taken.
  const wide = fx.fxDragR({ price: 100, n: 8, currency: 'USD', config });
  const tight = fx.fxDragR({ price: 100, n: 1, currency: 'USD', config });
  assert.ok(wide < tight);
  assert.ok(tight > 1, 'a very tight stop makes a US trade uneconomic');
});

test('the FX hurdle rejects a trade whose currency cost eats the edge', () => {
  const tight = fx.passesFxHurdle({ price: 100, n: 1, currency: 'USD', config });
  assert.equal(tight.passed, false);
  assert.match(tight.reason, /more than 35% of the/);

  const wide = fx.passesFxHurdle({ price: 100, n: 20, currency: 'USD', config });
  assert.equal(wide.passed, true);
});

test('the FX hurdle never blocks an account-currency trade', () => {
  const out = fx.passesFxHurdle({ price: 100, n: 0.5, currency: 'CAD', config });
  assert.equal(out.passed, true);
  assert.equal(out.drag, 0);
});

test('toAccountCurrency converts USD and passes CAD through', () => {
  assert.equal(fx.toAccountCurrency(100, 'CAD', 1.4, config), 100);
  assert.ok(Math.abs(fx.toAccountCurrency(100, 'USD', 1.4, config) - 140) < 1e-12);
  assert.throws(() => fx.toAccountCurrency(100, 'USD', 0, config), /no FX rate/);
});
