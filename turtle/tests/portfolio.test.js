'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const portfolio = require('../lib/portfolio');
const report = require('../lib/report');
const config = require('../config.json');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'turtle-'));
}

function seededState() {
  const state = portfolio.emptyPortfolio(config);
  state.positions.push({
    symbol: 'AAA',
    sector: 'Technology',
    system: 2,
    units: 1,
    shares: 20,
    avgPrice: 100,
    firstFillPrice: 100,
    lastFillPrice: 100,
    initialStop: 96,
    stop: 96,
    highestClose: 100,
    entryDate: '2026-08-01',
  });
  return state;
}

test('a missing state file yields an empty portfolio rather than an error', () => {
  const state = portfolio.loadPortfolio(tempRoot(), config);
  assert.equal(state.positions.length, 0);
  assert.equal(state.cash, config.account.equity);
  assert.equal(state.version, portfolio.STATE_VERSION);
});

test('state round-trips through save and load', () => {
  const root = tempRoot();
  portfolio.savePortfolio(root, seededState());
  const loaded = portfolio.loadPortfolio(root, config);

  assert.equal(loaded.positions.length, 1);
  assert.equal(loaded.positions[0].symbol, 'AAA');
  assert.ok(loaded.updatedAt, 'save must stamp a timestamp');
});

test('a version mismatch refuses to load rather than misreading the shape', () => {
  const root = tempRoot();
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'data', 'portfolio.json'),
    JSON.stringify({ version: 99, positions: [] })
  );
  assert.throws(() => portfolio.loadPortfolio(root, config), /version 99/);
});

test('reconcile reports a clean match', () => {
  const out = portfolio.reconcile(seededState(), [{ symbol: 'AAA', shares: 20 }]);
  assert.equal(out.clean, true);
  assert.equal(out.requiresConfirmation, false);
  assert.equal(out.matched.length, 1);
});

test('reconcile flags a share-count mismatch as a partial fill or triggered stop', () => {
  const out = portfolio.reconcile(seededState(), [{ symbol: 'AAA', shares: 12 }]);
  assert.equal(out.clean, false);
  assert.equal(out.requiresConfirmation, true);
  assert.equal(out.shareMismatches[0].delta, -8);
  assert.match(out.shareMismatches[0].note, /partial exit or a stop/);
});

test('reconcile flags a position held at the broker but not tracked', () => {
  const out = portfolio.reconcile(seededState(), [
    { symbol: 'AAA', shares: 20 },
    { symbol: 'ZZZ', shares: 5 },
  ]);
  assert.equal(out.untracked.length, 1);
  assert.equal(out.untracked[0].symbol, 'ZZZ');
  assert.equal(out.requiresConfirmation, true);
});

test('reconcile flags a tracked position absent at the broker', () => {
  const out = portfolio.reconcile(seededState(), []);
  assert.equal(out.missing.length, 1);
  assert.match(out.missing[0].note, /closed, most likely by a resting stop/);
});

test('reconcile never mutates the state it is given', () => {
  const state = seededState();
  const before = JSON.stringify(state);
  portfolio.reconcile(state, [{ symbol: 'AAA', shares: 3 }, { symbol: 'QQQ', shares: 1 }]);
  assert.equal(JSON.stringify(state), before, 'reconciliation must be read-only');
});

test('applyFill opens a position and records the initial stop separately', () => {
  const state = portfolio.emptyPortfolio(config);
  portfolio.applyFill(state, {
    symbol: 'AAA',
    sector: 'Technology',
    system: 2,
    shares: 20,
    price: 100,
    stop: 96,
    date: '2026-08-12',
  });

  const position = state.positions[0];
  assert.equal(position.shares, 20);
  assert.equal(position.units, 1);
  assert.equal(position.initialStop, 96);
  assert.equal(position.firstFillPrice, 100);
  assert.equal(state.cash, config.account.equity - 2000);
});

test('a pyramid add blends the average price and never lowers the stop', () => {
  const state = seededState();
  state.cash = 10000;
  portfolio.applyFill(state, {
    symbol: 'AAA',
    shares: 10,
    price: 106,
    stop: 94, // a lower stop must be ignored
    date: '2026-08-12',
  });

  const position = state.positions[0];
  assert.equal(position.shares, 30);
  assert.equal(position.units, 2);
  assert.equal(position.avgPrice, 102); // (100*20 + 106*10) / 30
  assert.equal(position.initialStop, 96, 'the initial stop is the R baseline and is immutable');
  assert.equal(position.stop, 96, 'a lower proposed stop must never be applied');
});

test('applyExit closes the position, banks cash and computes R', () => {
  const state = seededState();
  const trade = portfolio.applyExit(state, {
    symbol: 'AAA',
    price: 110,
    date: '2026-08-12',
    reason: 'donchian exit',
  });

  assert.equal(state.positions.length, 0);
  assert.equal(trade.r, 2.5); // (110 - 100) / (100 - 96)
  assert.equal(trade.pnl, 200);
  assert.equal(state.cash, config.account.equity + 2200);
});

test('a losing System 1 exit records whipsaw memory; System 2 does not', () => {
  const s1 = seededState();
  s1.positions[0].system = 1;
  portfolio.applyExit(s1, { symbol: 'AAA', price: 96, date: '2026-08-12', reason: 'stop' });
  assert.equal(s1.symbolState.AAA.lastSystem1Won, false);

  const s2 = seededState();
  portfolio.applyExit(s2, { symbol: 'AAA', price: 120, date: '2026-08-12', reason: 'exit' });
  assert.deepEqual(s2.symbolState, {}, 'System 2 outcomes must not gate System 1 entries');
});

test('exiting an untracked symbol throws instead of silently succeeding', () => {
  assert.throws(
    () => portfolio.applyExit(portfolio.emptyPortfolio(config), { symbol: 'NOPE', price: 1 }),
    /not tracked as an open position/
  );
});

test('the trade ledger appends rather than replaces', () => {
  const root = tempRoot();
  portfolio.appendTrade(root, { symbol: 'AAA', r: 2 });
  portfolio.appendTrade(root, { symbol: 'BBB', r: -1 });

  const ledger = portfolio.loadTrades(root);
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].symbol, 'AAA');
  assert.ok(ledger[0].recordedAt);
});

test('report renders a buy with every number needed to place the order', () => {
  const text = report.renderAction(
    {
      type: 'BUY',
      symbol: 'WSP',
      shares: 18,
      maxPrice: 172.4,
      notional: 3103.2,
      n: 3.71,
      unit: 1,
      maxUnits: 3,
      system: 2,
      risk: 133.56,
      riskPct: 0.0134,
      stop: 165,
      limit: 164.2,
      nextAdd: 174.26,
      expectation: { ok: true, winRate: 0.42, medianHoldWinners: 47, expectedR: 0.61, sample: 88 },
    },
    1
  );

  for (const needle of ['WSP', '18 sh', '$172.40', '$165.00', '$164.20', 'System 2', '$174.26']) {
    assert.ok(text.includes(needle), `brief must state ${needle}`);
  }
});

test('report states plainly when no stable expectation exists', () => {
  const text = report.renderAction(
    {
      type: 'BUY',
      symbol: 'AAA',
      shares: 1,
      maxPrice: 10,
      notional: 10,
      n: 1,
      unit: 1,
      maxUnits: 3,
      system: 2,
      risk: 2,
      riskPct: 0.0002,
      stop: 8,
      limit: 7.9,
      nextAdd: null,
      expectation: { ok: false, reason: 'only 6 historical analogues' },
    },
    1
  );
  assert.match(text, /no stable estimate/);
});

test('report separates data-integrity exclusions from merit-based rejections', () => {
  const text = report.render({
    date: '2026-08-12',
    equity: 10000,
    deployed: 0,
    deployedPct: 0,
    heatPct: 0,
    heatCapPct: 0.06,
    sourcesAgreed: 4,
    regime: { riskOn: true, distanceToSmaPct: 3.2, benchmarkSymbol: 'XIC' },
    actions: [],
    noAction: [{ symbol: 'CNQ', reason: 'efficiencyRatio 0.2400 < required 0.3' }],
    abstained: [{ symbol: 'ENB', reason: 'reconcile-exchange: 62bps disagreement' }],
    warnings: [],
    forward: { ok: false, reason: 'no validated backtest' },
  });

  assert.ok(text.includes('EXCLUDED ON DATA INTEGRITY'));
  assert.ok(text.includes('No recommendation is made on unverified prices'));
  assert.ok(text.includes('NO ACTION'));
  // The two must not be conflated — a data outage should never read as a quiet day.
  assert.ok(text.indexOf('CNQ') < text.indexOf('ENB'));
});

test('report warns rather than projecting when no gate has passed', () => {
  const text = report.renderForward({ ok: false, reason: 'no validated backtest to project from' });
  assert.match(text, /Unavailable: no validated backtest/);
});
