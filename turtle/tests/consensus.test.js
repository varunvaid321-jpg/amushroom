'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildConsensus, median } = require('../lib/consensus');
const { VERDICT } = require('../lib/integrity');
const config = require('../config.json');

const SETTLED = new Date('2026-08-12T21:00:00Z'); // 17:00 ET

function sessionDates(count, endDate = '2026-08-12') {
  const out = [];
  const cursor = new Date(`${endDate}T00:00:00Z`);
  while (out.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) out.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return out;
}

/**
 * Price is a function of the DATE, not of the array index, so two sources with
 * different history depths still agree on the sessions they share. Pricing by
 * index would make a 400-bar and a 300-bar source disagree on every common date.
 */
const EPOCH = Date.UTC(2020, 0, 1);
function priceOn(date) {
  const days = Math.round((new Date(`${date}T00:00:00Z`) - EPOCH) / 86400000);
  return 100 * Math.pow(1.001, days);
}

function makeSource(provider, count = 300, mutate = null) {
  const bars = sessionDates(count).map((date) => {
    const c = priceOn(date);
    return { t: `${date}T14:30:00.000Z`, o: c * 0.998, h: c * 1.006, l: c * 0.994, c, v: 500000 };
  });
  if (mutate) mutate(bars);
  return { provider, bars };
}

test('median handles odd and even counts', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test('three agreeing sources produce a VERIFIED verdict', () => {
  const out = buildConsensus({
    symbol: 'AAA',
    sources: [makeSource('yahoo'), makeSource('stooq'), makeSource('ibkr-cache')],
    config,
    now: SETTLED,
  });

  assert.equal(out.verdict, VERDICT.VERIFIED);
  assert.equal(out.quorum, 3);
  assert.equal(out.tradeable, true);
  assert.equal(out.bars.length, 300);
});

test('a single rogue source among three is outvoted, not allowed to stop the run', () => {
  // This is the heart of staying up: one provider going bad costs a source, not
  // the trade. With two sources this same disagreement would be unresolvable.
  const rogue = makeSource('stooq', 300, (bars) => {
    bars[299].c *= 1.08; // 800bps off, far beyond any tolerance
  });

  const out = buildConsensus({
    symbol: 'AAA',
    sources: [makeSource('yahoo'), rogue, makeSource('ibkr-cache')],
    config,
    now: SETTLED,
  });

  assert.notEqual(out.verdict, VERDICT.ABSTAIN, 'the majority must carry the decision');
  assert.equal(out.tradeable, true);
  assert.ok(out.rejectedOutliers.length > 0, 'the rogue value must be recorded as rejected');
  assert.equal(out.rejectedOutliers[0].provider, 'stooq');

  // The consensus close must come from the two honest sources, not the outlier.
  const honest = makeSource('yahoo').bars[299].c;
  assert.ok(Math.abs(out.bars[299].c - honest) < 1e-6);
});

test('two sources disagreeing materially abstain, because there is no majority', () => {
  const skewed = makeSource('stooq', 300, (bars) => {
    bars[299].c *= 1.01; // 100bps
  });

  const out = buildConsensus({
    symbol: 'AAA',
    sources: [makeSource('yahoo'), skewed],
    config,
    now: SETTLED,
  });

  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.equal(out.bars, null);
  assert.match(out.checks[0].detail, /no majority to resolve it/);
});

test('the conservative value is taken across sources', () => {
  // All four fields must be set coherently: leaving `o` at its generated value
  // while forcing h/l/c would violate the OHLC invariants and abstain for an
  // unrelated reason.
  const base = makeSource('yahoo').bars[299].c;
  const high = makeSource('yahoo', 300, (bars) => {
    Object.assign(bars[299], { o: base, h: base * 1.05, l: base * 0.95, c: base });
  });
  const low = makeSource('stooq', 300, (bars) => {
    Object.assign(bars[299], {
      o: base * 0.999,
      h: base * 1.0495,
      l: base * 0.9495,
      c: base * 0.9985,
    });
  });

  const out = buildConsensus({ symbol: 'AAA', sources: [high, low], config, now: SETTLED });
  const bar = out.bars[299];

  assert.equal(bar.h, base * 1.05, 'higher high — a breakout must clear the harder level');
  assert.equal(bar.l, base * 0.9495, 'lower low — assume the stop was reached');
  assert.equal(bar.c, base * 0.9985, 'lower close — less likely to trigger an entry');
  assert.equal(bar.o, base * 0.999, 'lower open — assume the worse gap fill');
});

test('a single available source reports WARN and is not tradeable', () => {
  // The run continues and the symbol is visible, but one source is not
  // verification and must never produce an order.
  const out = buildConsensus({
    symbol: 'AAA',
    sources: [makeSource('yahoo')],
    config,
    now: SETTLED,
  });

  assert.equal(out.quorum, 1);
  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.ok(out.checks.some((c) => c.name === 'quorum' && !c.passed));
});

test('zero sources abstains without throwing', () => {
  const out = buildConsensus({ symbol: 'AAA', sources: [], config, now: SETTLED });
  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.equal(out.bars, null);
  assert.match(out.checks[0].detail, /no provider returned data/);
});

test('sources with different history depths align on shared dates', () => {
  const long = makeSource('yahoo', 400);
  const short = makeSource('stooq', 300);

  const out = buildConsensus({ symbol: 'AAA', sources: [long, short], config, now: SETTLED });
  assert.equal(out.verdict, VERDICT.VERIFIED);
  assert.equal(out.bars.length, 400, 'thin history is kept for indicator warm-up');
  assert.equal(out.bars[399].sourceCount, 2, 'but the decision bar carries full quorum');
  assert.equal(out.bars[0].sourceCount, 1);
});

test('an unsettled session abstains even with full quorum', () => {
  const out = buildConsensus({
    symbol: 'AAA',
    sources: [makeSource('yahoo'), makeSource('stooq'), makeSource('ibkr-cache')],
    config,
    now: new Date('2026-08-12T18:00:00Z'), // 14:00 ET, still trading
  });

  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.ok(out.checks.some((c) => c.name === 'session-closed' && !c.passed));
});

test('structurally impossible consensus bars abstain', () => {
  const broken = (provider) =>
    makeSource(provider, 300, (bars) => {
      bars[150].h = bars[150].l - 5;
    });

  const out = buildConsensus({
    symbol: 'AAA',
    sources: [broken('yahoo'), broken('stooq')],
    config,
    now: SETTLED,
  });

  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.ok(out.checks.some((c) => c.name === 'invariants' && !c.passed));
});

test('insufficient history abstains rather than trading a short series', () => {
  const out = buildConsensus({
    symbol: 'AAA',
    sources: [makeSource('yahoo', 100), makeSource('stooq', 100)],
    config,
    now: SETTLED,
  });

  assert.equal(out.verdict, VERDICT.ABSTAIN);
  assert.ok(out.checks.some((c) => c.name === 'history-depth' && !c.passed));
});

test('a sub-tolerance disagreement is resolved quietly and stays tradeable', () => {
  const nudged = makeSource('stooq', 300, (bars) => {
    bars[299].h *= 1.0005; // 5bps, inside the 15bps band
  });

  const out = buildConsensus({
    symbol: 'AAA',
    sources: [makeSource('yahoo'), nudged, makeSource('ibkr-cache')],
    config,
    now: SETTLED,
  });

  assert.equal(out.verdict, VERDICT.VERIFIED);
  assert.equal(out.disagreements.length, 0);
  assert.equal(out.bars[299].h, nudged.bars[299].h, 'the higher high still wins');
});

test('a historical fatal disagreement drops one bar without killing the symbol', () => {
  const skewed = makeSource('stooq', 300, (bars) => {
    bars[100].c *= 1.02; // deep in history, not the decision bar
  });

  const out = buildConsensus({
    symbol: 'AAA',
    sources: [makeSource('yahoo'), skewed],
    config,
    now: SETTLED,
  });

  assert.equal(out.tradeable, true, 'a stale mid-history bar must not veto today');
  assert.equal(out.bars.length, 299, 'the disputed bar is dropped');
});
