'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const config = require('../config.json');

/**
 * End-to-end exercise of the real /turtle entrypoint against a synthetic cache.
 *
 * These tests run the actual script as a subprocess rather than importing its
 * internals, so they cover argument handling, file layout, integrity gating and
 * rendering the same way a live run does.
 */

const RUN = path.join(__dirname, '..', 'scripts', 'run.js');
const DATE = '2026-08-12';
const SETTLED = '2026-08-12T21:00:00Z'; // 17:00 ET, past settlement

function sessionDates(count, endDate) {
  const out = [];
  const cursor = new Date(`${endDate}T00:00:00Z`);
  while (out.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) out.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return out;
}

/** Trending series in IBKR's parallel-array response shape. */
function ibkrBars(count, { start = 50, drift = 0.0035, spread = 0.0015 } = {}) {
  const ds = sessionDates(count, DATE);
  const price = (i) => start * Math.pow(1 + drift, i) * (1 + 0.002 * Math.sin(i / 5));
  const response = { time: [], open: [], high: [], low: [], close: [], volume: [] };

  ds.forEach((d, i) => {
    const c = price(i);
    const o = i === 0 ? c : price(i - 1);
    response.time.push(`${d}T13:30:00Z`);
    response.open.push(o);
    response.high.push(Math.max(c, o) * (1 + spread));
    response.low.push(Math.min(c, o) * (1 - spread));
    response.close.push(c);
    response.volume.push(750000);
  });
  return response;
}

function writeCache(root, symbol, sources) {
  const dir = path.join(root, 'data', 'cache', DATE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${symbol.replace(/\./g, '_')}.json`), JSON.stringify(sources));
}

/** A cache with a rising benchmark and two trending names. */
function buildCache({ corrupt = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'turtle-e2e-'));

  const bench = ibkrBars(300, { start: 100, drift: 0.001 });
  writeCache(root, 'XIC', { primary: bench, secondary: bench });

  const aaa = ibkrBars(300, { start: 50 });
  writeCache(root, 'AAA', { primary: aaa, secondary: aaa });

  const bbb = ibkrBars(300, { start: 30, drift: 0.003 });
  if (corrupt) {
    // A 100bps disagreement on the final close: beyond the abstain threshold.
    const broken = JSON.parse(JSON.stringify(bbb));
    broken.close[299] *= 1.01;
    writeCache(root, 'BBB', { primary: bbb, secondary: broken });
  } else {
    writeCache(root, 'BBB', { primary: bbb, secondary: bbb });
  }

  return root;
}

function runTurtle(root, extra = []) {
  const stdout = execFileSync(
    process.execPath,
    [RUN, '--data-root', root, '--date', DATE, '--now', SETTLED, ...extra],
    { encoding: 'utf8' }
  );
  return stdout;
}

test('a full run produces a decision from cached data', () => {
  const root = buildCache();
  const decision = JSON.parse(runTurtle(root, ['--json']));

  assert.equal(decision.date, DATE);
  assert.equal(decision.regime.riskOn, true);
  assert.equal(decision.equity, config.account.equity);
  assert.ok(Array.isArray(decision.actions));
  assert.ok(decision.actions.length > 0, 'a clean uptrend on both names should produce entries');
});

test('every BUY carries the exact order parameters needed to place it', () => {
  const root = buildCache();
  const decision = JSON.parse(runTurtle(root, ['--json']));
  const buy = decision.actions.find((a) => a.type === 'BUY');

  assert.ok(buy, 'expected at least one BUY');
  assert.ok(Number.isInteger(buy.shares) && buy.shares > 0);
  assert.ok(buy.maxPrice > 0);
  assert.ok(buy.stop > 0 && buy.limit > 0);
  assert.ok(buy.limit < buy.stop, 'the stop-limit pair must be placeable');
  assert.ok(buy.stop < buy.maxPrice, 'a long stop must sit below the entry');
  assert.ok(buy.riskPct <= config.risk.riskPerUnitPct + 1e-9, 'unit risk must respect the budget');
});

test('the run is deterministic — identical input yields identical output', () => {
  // This is what makes a past recommendation auditable. If it ever fails, some
  // ordering or clock dependency has crept into the engine.
  const root = buildCache();
  assert.equal(runTurtle(root, ['--json']), runTurtle(root, ['--json']));
});

test('a symbol whose sources disagree beyond tolerance is excluded, not traded', () => {
  const root = buildCache({ corrupt: true });
  const decision = JSON.parse(runTurtle(root, ['--json']));

  assert.ok(
    decision.abstained.some((a) => a.symbol === 'BBB'),
    'BBB must be excluded on integrity grounds'
  );
  assert.ok(
    !decision.actions.some((a) => a.symbol === 'BBB'),
    'no recommendation may be issued for an abstained symbol'
  );
  assert.ok(decision.abstained[0].reason.includes('reconcile-exchange'));
});

test('an unsettled session blocks the entire run', () => {
  const root = buildCache();
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [RUN, '--data-root', root, '--date', DATE, '--now', '2026-08-12T18:00:00Z'],
        { encoding: 'utf8', stdio: 'pipe' }
      ),
    /Benchmark XIC did not pass integrity verification/,
    'a mid-session run must refuse rather than act on a forming bar'
  );
});

test('the run refuses to proceed without a verified benchmark', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'turtle-e2e-'));
  const aaa = ibkrBars(300);
  writeCache(root, 'AAA', { primary: aaa, secondary: aaa });

  assert.throws(
    () => runTurtle(root),
    /riding a full index drawdown to the bottom/,
    'the regime filter is not optional'
  );
});

test('the brief warns loudly when no validated backtest exists', () => {
  const root = buildCache();
  const decision = JSON.parse(runTurtle(root, ['--json']));

  assert.ok(
    decision.warnings.some((w) => w.includes('No backtest has been run')),
    'unvalidated recommendations must say so'
  );
  assert.equal(decision.forward.ok, false);
});

test('a failed backtest gate suppresses the forward view and warns', () => {
  const root = buildCache();
  fs.writeFileSync(
    path.join(root, 'data', 'backtest-latest.json'),
    JSON.stringify({ gatePassed: false, stats: { tradeCount: 50 }, trades: [] })
  );
  const decision = JSON.parse(runTurtle(root, ['--json']));

  assert.ok(decision.warnings.some((w) => w.includes('gate FAILED')));
  assert.equal(decision.forward.ok, false);
});

test('the run record is persisted for audit', () => {
  const root = buildCache();
  runTurtle(root, ['--json']);

  const file = path.join(root, 'data', 'runs', `${DATE}.json`);
  assert.ok(fs.existsSync(file), 'every run must leave an audit record');

  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(record.decision);
  assert.ok(Array.isArray(record.integrity.verified));
  assert.ok(record.generatedAt);
});

test('the rendered brief is human-readable and states the integrity status', () => {
  const root = buildCache();
  const text = runTurtle(root);

  assert.match(text, /TURTLE — 2026-08-12/);
  assert.match(text, /bars FINAL/);
  assert.match(text, /Regime: RISK-ON/);
  assert.match(text, /ACTIONS/);
  assert.match(text, /Place GTC stop-limit/);
});

test('a risk-off benchmark suppresses all entries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'turtle-e2e-'));
  const bench = ibkrBars(300, { start: 100, drift: -0.0015 });
  writeCache(root, 'XIC', { primary: bench, secondary: bench });
  const aaa = ibkrBars(300, { start: 50 });
  writeCache(root, 'AAA', { primary: aaa, secondary: aaa });

  const decision = JSON.parse(runTurtle(root, ['--json']));
  assert.equal(decision.regime.riskOn, false);
  assert.equal(
    decision.actions.filter((a) => a.type === 'BUY' || a.type === 'ADD').length,
    0
  );
});
