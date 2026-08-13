'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const integrity = require('../lib/integrity');
const config = require('../config.json');

const { VERDICT } = integrity;

/**
 * Fixtures deliberately corrupted one way at a time. The point of these tests is
 * not that clean data passes — it is that each specific way data can be wrong
 * produces the specific refusal it should.
 */

/** `count` weekday sessions ending on endDate, opening at 13:30Z (09:30 ET). */
function sessions(count, endDate = '2026-08-12', startPrice = 100) {
  const dates = [];
  const cursor = new Date(`${endDate}T00:00:00Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates.map((date, i) => {
    const c = startPrice * Math.pow(1.001, i);
    return {
      t: `${date}T13:30:00Z`,
      o: c * 0.998,
      h: c * 1.006,
      l: c * 0.994,
      c,
      v: 500000,
    };
  });
}

/** Bars back into the parallel-array shape IBKR actually returns. */
function toIbkr(bars) {
  return {
    time: bars.map((b) => b.t),
    open: bars.map((b) => b.o),
    high: bars.map((b) => b.h),
    low: bars.map((b) => b.l),
    close: bars.map((b) => b.c),
    volume: bars.map((b) => b.v),
  };
}

const SETTLED = new Date('2026-08-12T21:00:00Z'); // 17:00 ET, past settlement
const MID_SESSION = new Date('2026-08-12T18:00:00Z'); // 14:00 ET, still trading

test('parseIbkrHistory converts the parallel-array response into bars', () => {
  const bars = integrity.parseIbkrHistory({
    time: ['2026-08-12T13:30:00Z'],
    open: [151.98],
    high: [153.48],
    low: [148.69],
    close: [150.41],
    volume: [3446486],
  });
  assert.equal(bars.length, 1);
  assert.deepEqual(bars[0], {
    t: '2026-08-12T13:30:00Z',
    o: 151.98,
    h: 153.48,
    l: 148.69,
    c: 150.41,
    v: 3446486,
  });
});

test('parseIbkrHistory throws on a truncated array rather than zipping shorter', () => {
  assert.throws(
    () =>
      integrity.parseIbkrHistory({
        time: ['a', 'b'],
        open: [1, 2],
        high: [1, 2],
        low: [1],
        close: [1, 2],
        volume: [1, 2],
      }),
    /low length 1 does not match time length 2/
  );
});

test('session gate rejects a bar that is still forming', () => {
  const out = integrity.checkSessionClosed(sessions(5), MID_SESSION, config);
  assert.equal(out.passed, false);
  assert.equal(out.partial, true);
  assert.match(out.reason, /still forming/);
});

test('session gate accepts a bar once the settlement buffer has passed', () => {
  const out = integrity.checkSessionClosed(sessions(5), SETTLED, config);
  assert.equal(out.passed, true);
  assert.equal(out.barDate, '2026-08-12');
});

test('session gate rejects a bar dated ahead of the exchange date', () => {
  const out = integrity.checkSessionClosed(
    sessions(5, '2026-08-12'),
    new Date('2026-08-10T21:00:00Z'),
    config
  );
  assert.equal(out.passed, false);
  assert.match(out.reason, /ahead of the exchange date/);
});

test('session gate accepts a prior session on a later day, whatever the hour', () => {
  const out = integrity.checkSessionClosed(
    sessions(5, '2026-08-11'),
    new Date('2026-08-12T12:00:00Z'), // 08:00 ET, market not yet open
    config
  );
  assert.equal(out.passed, true);
});

test('invariants reject a high below the low', () => {
  const bars = sessions(5);
  bars[2].h = bars[2].l - 1;
  const out = integrity.checkInvariants(bars, config);
  assert.equal(out.passed, false);
  assert.ok(out.violations.some((v) => v.includes('is below low')));
});

test('invariants reject a high that does not contain the close', () => {
  const bars = sessions(5);
  bars[3].h = bars[3].c - 0.5;
  const out = integrity.checkInvariants(bars, config);
  assert.equal(out.passed, false);
  assert.ok(out.violations.some((v) => v.includes('below open/close')));
});

test('invariants reject a low above the open', () => {
  const bars = sessions(5);
  bars[1].l = bars[1].o + 0.5;
  const out = integrity.checkInvariants(bars, config);
  assert.equal(out.passed, false);
  assert.ok(out.violations.some((v) => v.includes('above open/close')));
});

test('invariants reject a zero-volume bar', () => {
  const bars = sessions(5);
  bars[2].v = 0;
  const out = integrity.checkInvariants(bars, config);
  assert.equal(out.passed, false);
  assert.ok(out.violations.some((v) => v.includes('volume is 0')));
});

test('invariants reject a non-finite price', () => {
  const bars = sessions(5);
  bars[2].c = NaN;
  const out = integrity.checkInvariants(bars, config);
  assert.equal(out.passed, false);
  assert.ok(out.violations.some((v) => v.includes('not a finite number')));
});

test('invariants reject duplicate and out-of-order timestamps', () => {
  const bars = sessions(5);
  bars[3].t = bars[2].t;
  const out = integrity.checkInvariants(bars, config);
  assert.equal(out.passed, false);
  assert.ok(out.violations.some((v) => v.includes('duplicate timestamp')));
  assert.ok(out.violations.some((v) => v.includes('not strictly after')));
});

test('invariants flag a probable unadjusted split without rejecting the series', () => {
  const bars = sessions(10);
  // A 2-for-1 split that the feed has not adjusted looks like a -50% day.
  for (let i = 5; i < bars.length; i += 1) {
    bars[i].o /= 2;
    bars[i].h /= 2;
    bars[i].l /= 2;
    bars[i].c /= 2;
  }
  const out = integrity.checkInvariants(bars, config);
  assert.equal(out.passed, true); // structurally valid...
  assert.equal(out.suspectMoves.length, 1); // ...but loudly suspicious
  assert.match(out.suspectMoves[0], /verify no unadjusted corporate action/);
});

test('aggregateToDaily folds intraday bars into one session', () => {
  const hourly = [
    { t: '2026-08-12T13:30:00Z', o: 100, h: 103, l: 99, c: 101, v: 10 },
    { t: '2026-08-12T14:30:00Z', o: 101, h: 105, l: 100, c: 104, v: 20 },
    { t: '2026-08-11T14:30:00Z', o: 90, h: 92, l: 89, c: 91, v: 5 },
  ];
  const daily = integrity.aggregateToDaily(hourly, config.integrity.exchangeTimezone);
  const aug12 = daily.find((d) => d.date === '2026-08-12');

  assert.equal(aug12.o, 100); // first bar's open
  assert.equal(aug12.h, 105); // highest high
  assert.equal(aug12.l, 99); // lowest low
  assert.equal(aug12.c, 104); // last bar's close
  assert.equal(aug12.v, 30); // summed volume
});

test('reconcile passes silently when two sources agree', () => {
  const bars = sessions(10);
  const out = integrity.reconcile(bars, bars, config, 'test');
  assert.equal(out.passed, true);
  assert.equal(out.discrepancies.length, 0);
  assert.equal(out.compared, 10);
});

test('reconcile adopts the HIGHER high even below the warn threshold', () => {
  // The real SHOP case: 153.48 via SMART, 153.29 via the native exchange —
  // 12.4bps apart, which sits UNDER the 15bps band. It must still resolve to
  // the harder breakout level, because a close landing between the two would
  // otherwise be scored as a breakout against the softer number.
  const primary = sessions(3);
  const secondary = primary.map((b) => ({ ...b }));
  primary[2].h = 153.29; // primary holds the SOFTER level here
  secondary[2].h = 153.48;

  const out = integrity.reconcile(primary, secondary, config, 'native-exchange');
  assert.ok(integrity.diffBps(153.48, 153.29) < config.integrity.highLowToleranceBps);
  assert.equal(out.passed, true);
  assert.equal(out.discrepancies.length, 0, 'a sub-tolerance gap is not worth reporting');
  assert.equal(out.adopted, 1, 'but the safer value is still taken');
  assert.equal(out.bars[2].h, 153.48);
});

test('reconcile adopts the LOWER low even below the warn threshold', () => {
  const primary = sessions(3);
  const secondary = primary.map((b) => ({ ...b }));
  primary[2].l = 148.69;
  secondary[2].l = 148.60;

  const out = integrity.reconcile(primary, secondary, config, 'test');
  assert.equal(out.bars[2].l, 148.6, 'the lower low is the conservative choice for stops');
});

test('reconcile adopts the LOWER close inside the warn band', () => {
  const primary = sessions(3);
  const secondary = primary.map((b) => ({ ...b }));
  primary[2].c = 100.5;
  secondary[2].c = 100.3; // ~20bps apart, above the 10bps close tolerance

  const out = integrity.reconcile(primary, secondary, config, 'test');
  assert.equal(out.bars[2].c, 100.3, 'the lower close is the conservative choice');
});

test('reconcile marks a gap beyond 50bps as fatal', () => {
  const primary = sessions(3);
  const secondary = primary.map((b) => ({ ...b }));
  primary[2].c = 100;
  secondary[2].c = 101; // 99bps

  const out = integrity.reconcile(primary, secondary, config, 'test');
  assert.equal(out.passed, false);
  assert.equal(out.fatal.length, 1);
  assert.ok(out.fatal[0].bps > config.integrity.abstainToleranceBps);
});

test('snapshot envelope flags a computed high above the reported 52-week high', () => {
  const bars = sessions(260);
  const out = integrity.checkSnapshotEnvelope(
    bars,
    { 'misc-statistics': { high_52w: 50, low_52w: 10 } },
    config
  );
  assert.equal(out.passed, false);
  assert.ok(out.findings.some((f) => f.includes('exceeds the reported')));
});

test('snapshot envelope passes when computed levels sit inside the reported range', () => {
  const bars = sessions(260);
  const high = Math.max(...bars.map((b) => b.h));
  const low = Math.min(...bars.map((b) => b.l));
  const out = integrity.checkSnapshotEnvelope(
    bars,
    { 'misc-statistics': { high_52w: high * 1.01, low_52w: low * 0.99 } },
    config
  );
  assert.equal(out.passed, true);
});

test('snapshot envelope skips cleanly when statistics are unavailable', () => {
  const out = integrity.checkSnapshotEnvelope(sessions(260), null, config);
  assert.equal(out.passed, true);
  assert.equal(out.skipped, true);
});

test('verifySymbol returns VERIFIED with all four sources agreeing', () => {
  const bars = sessions(300);
  const high = Math.max(...bars.slice(-252).map((b) => b.h));
  const low = Math.min(...bars.slice(-252).map((b) => b.l));

  const out = integrity.verifySymbol({
    symbol: 'TEST',
    sources: {
      primary: toIbkr(bars),
      secondary: toIbkr(bars),
      hourly: toIbkr(bars.slice(-5)),
      snapshot: { 'misc-statistics': { high_52w: high * 1.01, low_52w: low * 0.99 } },
    },
    now: SETTLED,
    config,
  });

  assert.equal(out.verdict, VERDICT.VERIFIED);
  assert.equal(out.tradeable, true);
  assert.equal(out.sourcesAgreed, 4);
  assert.ok(out.bars.length === 300);
});

test('verifySymbol ABSTAINS on an unsettled session and returns no bars', () => {
  const bars = sessions(300);
  const out = integrity.verifySymbol({
    symbol: 'TEST',
    sources: { primary: toIbkr(bars) },
    now: MID_SESSION,
    config,
  });

  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.equal(out.tradeable, false);
  assert.equal(out.bars, null, 'abstained symbols must expose no prices at all');
});

test('verifySymbol ABSTAINS when two sources disagree beyond tolerance', () => {
  const bars = sessions(300);
  const corrupted = bars.map((b) => ({ ...b }));
  corrupted[299].c = bars[299].c * 1.01; // 100bps

  const out = integrity.verifySymbol({
    symbol: 'TEST',
    sources: { primary: toIbkr(bars), secondary: toIbkr(corrupted) },
    now: SETTLED,
    config,
  });

  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.equal(out.bars, null);
  assert.ok(out.checks.some((c) => c.name === 'reconcile-exchange' && !c.passed));
});

test('verifySymbol ABSTAINS on insufficient history rather than trading on a short series', () => {
  const out = integrity.verifySymbol({
    symbol: 'TEST',
    sources: { primary: toIbkr(sessions(100)) },
    now: SETTLED,
    config,
  });
  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.ok(out.checks.some((c) => c.name === 'history-depth' && !c.passed));
});

test('verifySymbol WARNS but stays tradeable when optional sources are missing', () => {
  const bars = sessions(300);
  const out = integrity.verifySymbol({
    symbol: 'TEST',
    sources: { primary: toIbkr(bars) },
    now: SETTLED,
    config,
  });

  assert.equal(out.verdict, VERDICT.WARN);
  assert.equal(out.tradeable, true);
  assert.equal(out.sourcesAgreed, 1);
  assert.ok(out.bars !== null);
});

test('verifySymbol ABSTAINS on a malformed payload without throwing', () => {
  const out = integrity.verifySymbol({
    symbol: 'TEST',
    sources: { primary: { time: ['a'], open: [1], high: [1], low: [1], close: [1] } },
    now: SETTLED,
    config,
  });
  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.equal(out.bars, null);
  assert.equal(out.checks[0].name, 'parse');
});

test('verifySymbol ABSTAINS on structurally impossible bars', () => {
  const bars = sessions(300);
  bars[150].h = bars[150].l - 5;
  const out = integrity.verifySymbol({
    symbol: 'TEST',
    sources: { primary: toIbkr(bars) },
    now: SETTLED,
    config,
  });
  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.ok(out.checks.some((c) => c.name === 'invariants' && !c.passed));
});
