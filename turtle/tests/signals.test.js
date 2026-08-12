'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const signals = require('../lib/signals');
const config = require('../config.json');

/** Build bars from a close series with a fixed 0.5% intraday range. */
function makeBars(closes, spread = 0.005) {
  return closes.map((c, i) => ({
    t: `2026-01-${String(i + 1).padStart(2, '0')}`,
    o: i === 0 ? c : closes[i - 1],
    h: c * (1 + spread),
    l: c * (1 - spread),
    c,
    v: 100000,
  }));
}

/** Flat base with an optional earlier spike, then a final close. */
function series({ length = 70, base = 100, spikeIndex = null, spikeValue = 130, finalClose }) {
  const closes = new Array(length).fill(base);
  if (spikeIndex !== null) closes[spikeIndex] = spikeValue;
  closes.push(finalClose);
  return makeBars(closes);
}

test('System 2 fires when the close exceeds the 55-day high', () => {
  const bars = series({ finalClose: 110 });
  const indicators = signals.computeIndicators(bars, config);
  const entry = signals.evaluateEntry(bars, indicators, bars.length - 1, config);

  assert.equal(entry.triggered, true);
  assert.equal(entry.system, 2);
  assert.ok(entry.n > 0);
  assert.ok(entry.extensionN > 0);
});

test('System 1 fires only when System 2 does not, and reports the 10-day exit', () => {
  // The spike sits inside the 55-day window but outside the 20-day window, so
  // the close clears the 20-day high while staying under the 55-day high.
  const bars = series({ spikeIndex: 45, spikeValue: 130, finalClose: 105 });
  const indicators = signals.computeIndicators(bars, config);
  const entry = signals.evaluateEntry(bars, indicators, bars.length - 1, config);

  assert.equal(entry.triggered, true);
  assert.equal(entry.system, 1);
  assert.equal(entry.exitLookback, config.signals.system1.exitLookback);
});

test('whipsaw filter blocks a System 1 entry after a winning System 1 breakout', () => {
  const bars = series({ spikeIndex: 45, spikeValue: 130, finalClose: 105 });
  const indicators = signals.computeIndicators(bars, config);
  const entry = signals.evaluateEntry(bars, indicators, bars.length - 1, config, {
    lastSystem1Won: true,
  });

  assert.equal(entry.triggered, false);
  assert.match(entry.reason, /whipsaw filter/);
});

test('whipsaw filter never blocks System 2', () => {
  const bars = series({ finalClose: 110 });
  const indicators = signals.computeIndicators(bars, config);
  const entry = signals.evaluateEntry(bars, indicators, bars.length - 1, config, {
    lastSystem1Won: true,
  });

  assert.equal(entry.triggered, true);
  assert.equal(entry.system, 2);
});

test('a close exactly at the channel is not a breakout', () => {
  const bars = series({ finalClose: 100 });
  const indicators = signals.computeIndicators(bars, config);
  const i = bars.length - 1;
  // Force the close to sit exactly on the 55-day high.
  bars[i].c = indicators.s2High[i];

  const entry = signals.evaluateEntry(bars, indicators, i, config);
  assert.equal(entry.triggered, false);
  assert.equal(entry.reason, 'no breakout');
});

test('no entry is produced when ATR is unavailable', () => {
  const bars = makeBars(new Array(10).fill(100).concat([110]));
  const indicators = signals.computeIndicators(bars, config);
  const entry = signals.evaluateEntry(bars, indicators, bars.length - 1, config);

  assert.equal(entry.triggered, false);
  assert.match(entry.reason, /ATR/);
});

test('quality gates pass on a clean sustained uptrend', () => {
  const closes = [];
  for (let i = 0; i < 90; i += 1) closes.push(100 * Math.pow(1.004, i));
  const bars = makeBars(closes, 0.002);
  const indicators = signals.computeIndicators(bars, config);
  const quality = signals.evaluateQuality(indicators, bars.length - 1, config);

  assert.equal(quality.passed, true, `unexpected failures: ${quality.reasons.join('; ')}`);
});

test('quality gates reject a choppy series and name every failing check', () => {
  const closes = [];
  for (let i = 0; i < 90; i += 1) closes.push(i % 2 === 0 ? 100 : 104);
  const bars = makeBars(closes, 0.002);
  const indicators = signals.computeIndicators(bars, config);
  const quality = signals.evaluateQuality(indicators, bars.length - 1, config);

  assert.equal(quality.passed, false);
  assert.ok(quality.reasons.length > 0);
  assert.ok(quality.reasons.some((r) => r.startsWith('efficiencyRatio')));
});

test('quality gates reject a downtrend on slope even when the trend is clean', () => {
  const closes = [];
  for (let i = 0; i < 90; i += 1) closes.push(200 * Math.pow(0.996, i));
  const bars = makeBars(closes, 0.002);
  const indicators = signals.computeIndicators(bars, config);
  const quality = signals.evaluateQuality(indicators, bars.length - 1, config);

  assert.equal(quality.passed, false);
  assert.ok(quality.reasons.some((r) => r.startsWith('slope')));
});

test('exit fires when the close breaks the exit channel of the entry system', () => {
  const closes = new Array(70).fill(100);
  closes.push(80); // decisive break below the 20-day low
  const bars = makeBars(closes);
  const indicators = signals.computeIndicators(bars, config);
  const exit = signals.evaluateExit(
    bars,
    indicators,
    bars.length - 1,
    { system: 2 },
    config
  );

  assert.equal(exit.triggered, true);
  assert.equal(exit.kind, 'donchian');
  assert.match(exit.reason, /20-day low/);
});

test('the exit channel is fixed by the entry system, not re-chosen each day', () => {
  // Close sits below the 10-day low but above the 20-day low. A System 2
  // position must hold; a System 1 position must exit.
  const closes = [];
  for (let i = 0; i < 40; i += 1) closes.push(100);
  for (let i = 0; i < 15; i += 1) closes.push(112);
  closes.push(105);
  const bars = makeBars(closes);
  const indicators = signals.computeIndicators(bars, config);
  const i = bars.length - 1;

  assert.equal(signals.evaluateExit(bars, indicators, i, { system: 1 }, config).triggered, true);
  assert.equal(signals.evaluateExit(bars, indicators, i, { system: 2 }, config).triggered, false);
});

test('stop fills at the stop price when it trades through intraday', () => {
  const bar = { o: 100, h: 101, l: 94, c: 95 };
  const hit = signals.evaluateStopHit(bar, 96);

  assert.equal(hit.triggered, true);
  assert.equal(hit.fillPrice, 96);
  assert.equal(hit.gapped, false);
});

test('stop fills at the OPEN when the market gaps through it', () => {
  // Modelling this fill at the stop price would understate real drawdowns.
  const bar = { o: 88, h: 90, l: 85, c: 86 };
  const hit = signals.evaluateStopHit(bar, 96);

  assert.equal(hit.triggered, true);
  assert.equal(hit.fillPrice, 88);
  assert.equal(hit.gapped, true);
  assert.match(hit.reason, /gapped through stop/);
});

test('stop does not trigger when the low stays above it', () => {
  assert.equal(signals.evaluateStopHit({ o: 100, h: 102, l: 97, c: 101 }, 96).triggered, false);
  assert.equal(signals.evaluateStopHit({ o: 100, h: 102, l: 97, c: 101 }, null).triggered, false);
});
