'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const yahoo = require('../lib/providers/yahoo');
const stooq = require('../lib/providers/stooq');
const { providersFor } = require('../lib/providers');
const config = require('../config.json');

/**
 * Parser tests run against fixtures rather than the network, so they hold
 * regardless of whether a provider is reachable. Reachability is a separate
 * question answered by `npm run turtle:doctor` on the machine that will run this.
 */

test('yahoo maps TSX symbols with the .TO suffix', () => {
  assert.equal(yahoo.symbolFor({ symbol: 'SHOP', currency: 'CAD' }), 'SHOP.TO');
  assert.equal(yahoo.symbolFor({ symbol: 'AEM', currency: 'CAD' }), 'AEM.TO');
});

test('yahoo maps class shares and REIT units with a hyphen', () => {
  // Getting this wrong does not error — it fetches a different instrument.
  assert.equal(yahoo.symbolFor({ symbol: 'TECK.B', currency: 'CAD' }), 'TECK-B.TO');
  assert.equal(yahoo.symbolFor({ symbol: 'REI.UN', currency: 'CAD' }), 'REI-UN.TO');
  assert.equal(yahoo.symbolFor({ symbol: 'BRK.B', currency: 'USD' }), 'BRK-B');
});

test('yahoo leaves plain US symbols bare', () => {
  assert.equal(yahoo.symbolFor({ symbol: 'AAPL', currency: 'USD' }), 'AAPL');
});

test('yahoo picks the smallest range covering the requested history', () => {
  assert.equal(yahoo.rangeFor(20), '1mo');
  assert.equal(yahoo.rangeFor(400), '2y');
  assert.equal(yahoo.rangeFor(1300), '5y');
});

test('yahoo parses a well-formed chart response', () => {
  const parsed = yahoo.parse({
    chart: {
      error: null,
      result: [
        {
          timestamp: [1786563000, 1786649400],
          indicators: {
            quote: [
              {
                open: [151.98, 150.31],
                high: [153.48, 155.62],
                low: [148.69, 149.0],
                close: [150.41, 155.18],
                volume: [3446486, 1794331],
              },
            ],
          },
        },
      ],
    },
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.bars.length, 2);
  assert.equal(parsed.bars[0].c, 150.41);
  assert.equal(parsed.bars[1].h, 155.62);
});

test('yahoo drops null-padded sessions instead of coercing them to zero', () => {
  // A null close read as 0 would look like a total collapse and could fire a signal.
  const parsed = yahoo.parse({
    chart: {
      result: [
        {
          timestamp: [1786563000, 1786649400, 1786735800],
          indicators: {
            quote: [
              {
                open: [10, null, 12],
                high: [11, null, 13],
                low: [9, null, 11],
                close: [10.5, null, 12.5],
                volume: [1000, null, 1200],
              },
            ],
          },
        },
      ],
    },
  });

  assert.equal(parsed.bars.length, 2);
  assert.ok(parsed.bars.every((b) => b.c > 0));
});

test('yahoo rejects zero-volume rows', () => {
  const parsed = yahoo.parse({
    chart: {
      result: [
        {
          timestamp: [1786563000],
          indicators: {
            quote: [{ open: [10], high: [11], low: [9], close: [10], volume: [0] }],
          },
        },
      ],
    },
  });
  assert.equal(parsed.ok, false);
});

test('yahoo surfaces a provider-side error rather than returning empty bars', () => {
  const parsed = yahoo.parse({ chart: { error: { code: 'Not Found', description: 'No data found' } } });
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /No data found/);
});

test('yahoo handles a malformed response without throwing', () => {
  for (const bad of [{}, { chart: {} }, { chart: { result: [] } }, { chart: { result: [{}] } }]) {
    const parsed = yahoo.parse(bad);
    assert.equal(parsed.ok, false);
    assert.ok(parsed.error);
  }
});

test('stooq maps market suffixes and lowercases', () => {
  assert.equal(stooq.symbolFor({ symbol: 'AAPL', currency: 'USD' }), 'aapl.us');
  assert.equal(stooq.symbolFor({ symbol: 'SHOP', currency: 'CAD' }), 'shop.ca');
  assert.equal(stooq.symbolFor({ symbol: 'TECK.B', currency: 'CAD' }), 'teck-b.ca');
});

test('stooq parses daily CSV in ascending date order', () => {
  const parsed = stooq.parse(
    ['Date,Open,High,Low,Close,Volume', '2026-08-11,151.0,152.0,150.0,151.5,1000000', '2026-08-12,151.98,153.48,148.69,150.41,3446486'].join('\n')
  );

  assert.equal(parsed.ok, true);
  assert.equal(parsed.bars.length, 2);
  assert.ok(parsed.bars[0].t < parsed.bars[1].t);
  assert.equal(parsed.bars[1].c, 150.41);
});

test('stooq treats a "No data" body as a miss, not a crash', () => {
  // Stooq answers unknown symbols with HTTP 200 and this body.
  const parsed = stooq.parse('No data');
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /no data/i);
});

test('stooq rejects an unexpected header rather than mis-indexing columns', () => {
  const parsed = stooq.parse('Foo,Bar\n1,2');
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /unexpected CSV header/);
});

test('stooq skips malformed rows but keeps the good ones', () => {
  const parsed = stooq.parse(
    [
      'Date,Open,High,Low,Close,Volume',
      '2026-08-11,151.0,152.0,150.0,151.5,1000000',
      'garbage line',
      '2026-08-12,N/A,N/A,N/A,N/A,0',
      '2026-08-13,152.0,153.0,151.0,152.5,900000',
    ].join('\n')
  );

  assert.equal(parsed.ok, true);
  assert.equal(parsed.bars.length, 2);
});

test('stooq returns empty rather than fabricating when every row is unusable', () => {
  const parsed = stooq.parse('Date,Open,High,Low,Close,Volume\n2026-08-12,N/A,N/A,N/A,N/A,0');
  assert.equal(parsed.ok, false);
});

test('the registry honours the configured provider list', () => {
  const all = providersFor(config).map((p) => p.name);
  assert.deepEqual(all, ['yahoo', 'stooq', 'ibkr-cache']);

  const narrowed = providersFor({ providers: { enabled: ['yahoo'] } }).map((p) => p.name);
  assert.deepEqual(narrowed, ['yahoo']);
});

test('the registry ignores an unknown provider name instead of throwing', () => {
  const names = providersFor({ providers: { enabled: ['yahoo', 'nonexistent'] } }).map((p) => p.name);
  assert.deepEqual(names, ['yahoo']);
});
