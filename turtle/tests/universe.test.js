'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const universe = require('../lib/universe');
const config = require('../config.json');

/** Trimmed from the real search_contracts response for "CSU". */
const CSU_SEARCH = {
  results: [
    {
      underlying_contract_id: 39194759,
      exchange: 'TSE',
      symbol: 'CSU',
      description: 'CONSTELLATION SOFTWARE INC',
      country_code: 'CA',
      sections: [{ security_type: 'STK' }, { security_type: 'IOPT' }],
    },
    {
      underlying_contract_id: 824831205,
      exchange: 'TSE',
      symbol: 'CSUU',
      description: 'SL (2X) CONSTELLATION SO ETF',
      country_code: 'CA',
      sections: [{ security_type: 'STK' }],
    },
    {
      underlying_contract_id: 872864807,
      exchange: 'TSE',
      symbol: 'CSUC',
      description: 'NINEPOINT CONST SFTWR CORESH',
      country_code: 'CA',
      sections: [{ security_type: 'STK' }],
    },
    {
      underlying_contract_id: 72083288,
      exchange: 'EBS',
      symbol: 'CSUS',
      description: 'ISHARES MSCI USA USD ACC',
      country_code: 'CH',
      sections: [{ security_type: 'STK' }],
    },
  ],
};

/** Trimmed from the real search_contracts response for "AEM". */
const AEM_SEARCH = {
  results: [
    {
      underlying_contract_id: 4205,
      exchange: 'NYSE',
      symbol: 'AEM',
      description: 'AGNICO EAGLE MINES LTD',
      country_code: 'US',
      sections: [{ security_type: 'STK' }],
    },
    {
      underlying_contract_id: 14905022,
      exchange: 'TSE',
      symbol: 'AEM',
      description: 'AGNICO EAGLE MINES LTD',
      country_code: 'CA',
      sections: [{ security_type: 'STK' }, { security_type: 'OPT' }],
    },
    {
      underlying_contract_id: 808625147,
      exchange: 'TSE',
      symbol: 'AEME',
      description: 'HARVEST AGNICO EAG EH IS ETF',
      country_code: 'CA',
      sections: [{ security_type: 'STK' }],
    },
  ],
};

test('selects the TSE row and ignores the identical NYSE listing', () => {
  const out = universe.selectTseRow('AEM', AEM_SEARCH);
  assert.equal(out.ok, true);
  assert.equal(out.contract.contractId, 14905022);
  assert.equal(out.contract.exchange, 'TSE');
  assert.equal(out.contract.currency, 'CAD');
});

test('exact-symbol matching rejects the leveraged and covered-call lookalikes', () => {
  // CSUU (2x) and CSUC (covered call) are both TSE-listed Canadian stock rows.
  // Only exact symbol matching keeps them out.
  const out = universe.selectTseRow('CSU', CSU_SEARCH);
  assert.equal(out.ok, true);
  assert.equal(out.contract.contractId, 39194759);
  assert.equal(out.contract.description, 'CONSTELLATION SOFTWARE INC');
});

test('resolves dotted TSX class-share tickers', () => {
  const out = universe.selectTseRow('TECK.B', {
    results: [
      {
        underlying_contract_id: 39921623,
        exchange: 'NYSE',
        symbol: 'TECK',
        description: 'TECK RESOURCES LTD-CLS B',
        country_code: 'US',
        sections: [{ security_type: 'STK' }],
      },
      {
        underlying_contract_id: 4458983,
        exchange: 'TSE',
        symbol: 'TECK.B',
        description: 'TECK RESOURCES LTD-CLS B',
        country_code: 'CA',
        sections: [{ security_type: 'STK' }],
      },
      {
        underlying_contract_id: 14894265,
        exchange: 'TSE',
        symbol: 'TECK.A',
        description: 'TECK RESOURCES LTD-CLS A',
        country_code: 'CA',
        sections: [{ security_type: 'STK' }],
      },
    ],
  });
  assert.equal(out.ok, true);
  assert.equal(out.contract.contractId, 4458983, 'must not pick the class A line');
});

test('resolves REIT unit tickers', () => {
  const out = universe.selectTseRow('REI.UN', {
    results: [
      {
        underlying_contract_id: 14893589,
        exchange: 'TSE',
        symbol: 'REI.UN',
        description: 'RIOCAN REAL ESTATE INVST TR',
        country_code: 'CA',
        sections: [{ security_type: 'STK' }, { security_type: 'OPT' }],
      },
    ],
  });
  assert.equal(out.ok, true);
  assert.equal(out.contract.contractId, 14893589);
});

test('rejects an empty search rather than returning nothing usable', () => {
  const out = universe.selectTseRow('NOPE', { results: [] });
  assert.equal(out.ok, false);
  assert.match(out.reason, /no results/);
});

test('rejects when the ticker exists only outside Canada', () => {
  const out = universe.selectTseRow('CSUS', CSU_SEARCH);
  assert.equal(out.ok, false);
  assert.match(out.reason, /no exact TSE match/);
});

test('rejects an ambiguous double match instead of picking one', () => {
  const duplicated = {
    results: [
      {
        underlying_contract_id: 1,
        exchange: 'TSE',
        symbol: 'DUP',
        description: 'FIRST CO',
        country_code: 'CA',
        sections: [{ security_type: 'STK' }],
      },
      {
        underlying_contract_id: 2,
        exchange: 'TSE',
        symbol: 'DUP',
        description: 'SECOND CO',
        country_code: 'CA',
        sections: [{ security_type: 'STK' }],
      },
    ],
  };
  const out = universe.selectTseRow('DUP', duplicated);
  assert.equal(out.ok, false);
  assert.match(out.reason, /ambiguous: 2 exact TSE matches/);
});

test('rejects a row without a stock section', () => {
  const out = universe.selectTseRow('BONDY', {
    results: [
      {
        underlying_contract_id: 9,
        exchange: 'TSE',
        symbol: 'BONDY',
        description: 'SOME TRUST',
        country_code: 'CA',
        sections: [{ security_type: 'BOND' }],
      },
    ],
  });
  assert.equal(out.ok, false);
});

test('rejects a leveraged product even on an exact symbol match', () => {
  const out = universe.selectTseRow('CSUU', CSU_SEARCH);
  assert.equal(out.ok, false);
  assert.match(out.reason, /excluded product pattern/);
});

test('allows the benchmark ETF through the product filter', () => {
  const out = universe.selectTseRow('XIC', {
    results: [
      {
        underlying_contract_id: 74580634,
        exchange: 'TSE',
        symbol: 'XIC',
        description: 'ISHARES CORE S&P/TSX CAPPED',
        country_code: 'CA',
        sections: [{ security_type: 'STK' }],
      },
    ],
  });
  assert.equal(out.ok, true);
  assert.equal(out.contract.contractId, 74580634);
});

test('screenTradeable rejects a share price above the ceiling', () => {
  // The real CSU.TO case at roughly $3,058.
  const out = universe.screenTradeable(
    { symbol: 'CSU' },
    { last: { price: 3057.64 }, 'avg-90d-usd-volume': { volume: 1.5e8 } },
    config
  );
  assert.equal(out.tradeable, false);
  assert.ok(out.failures.some((f) => f.includes('exceeds the $1000 ceiling')));
});

test('screenTradeable rejects an illiquid name', () => {
  const out = universe.screenTradeable(
    { symbol: 'THIN' },
    { last: { price: 20 }, 'avg-90d-usd-volume': { volume: 100000 } },
    config
  );
  assert.equal(out.tradeable, false);
  assert.ok(out.failures.some((f) => f.includes('liquidity floor')));
});

test('screenTradeable passes a liquid mid-cap', () => {
  const out = universe.screenTradeable(
    { symbol: 'AEM' },
    { last: { price: 257.82 }, 'avg-90d-usd-volume': { volume: 333676670 } },
    config
  );
  assert.equal(out.tradeable, true);
  assert.deepEqual(out.failures, []);
  assert.equal(out.price, 257.82);
});

test('screenTradeable reports missing data as a failure, not a pass', () => {
  const out = universe.screenTradeable({ symbol: 'X' }, {}, config);
  assert.equal(out.tradeable, false);
  assert.equal(out.failures.length, 2);
});

test('buildUniverse keeps rejections with their reasons for audit', () => {
  const built = universe.buildUniverse(
    [
      {
        symbol: 'AEM',
        name: 'Agnico Eagle',
        sector: 'Materials',
        result: universe.selectTseRow('AEM', AEM_SEARCH),
      },
      {
        symbol: 'GONE',
        name: 'Delisted Co',
        sector: 'Energy',
        result: universe.selectTseRow('GONE', { results: [] }),
      },
    ],
    { verifiedAt: '2026-08-12' }
  );

  assert.equal(built.counts.resolved, 1);
  assert.equal(built.counts.rejected, 1);
  assert.equal(built.symbols[0].symbol, 'AEM');
  assert.equal(built.symbols[0].sector, 'Materials');
  assert.equal(built.rejected[0].symbol, 'GONE');
  assert.match(built.rejected[0].reason, /no results/);
  assert.deepEqual(built.counts.bySector, { Materials: 1 });
});
