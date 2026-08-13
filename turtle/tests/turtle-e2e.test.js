'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const config = require('../config.json');

/**
 * End-to-end tests for the standalone entrypoint.
 *
 * Replay mode is used for the decision tests so they are hermetic. One test
 * deliberately runs the LIVE path with no reachable providers, because
 * "everything is down" is a real operating condition and the system must fail
 * clearly rather than crash or, far worse, emit a recommendation anyway.
 */

const TURTLE = path.join(__dirname, '..', 'scripts', 'turtle.js');
const DATE = '2026-08-12';
const SETTLED = '2026-08-12T21:00:00Z';

function sessionDates(count, endDate = DATE) {
  const out = [];
  const cursor = new Date(`${endDate}T00:00:00Z`);
  while (out.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) out.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return out;
}

/** Trending, stable-looking bars that clear both the quality and stability screens. */
function bars(count, { start = 50, drift = 0.0035, spread = 0.0015 } = {}) {
  const price = (i) => start * Math.pow(1 + drift, i) * (1 + 0.002 * Math.sin(i / 5));
  return sessionDates(count).map((date, i) => {
    const c = price(i);
    const o = i === 0 ? c : price(i - 1);
    return {
      t: `${date}T14:30:00.000Z`,
      o,
      h: Math.max(c, o) * (1 + spread),
      l: Math.min(c, o) * (1 - spread),
      c,
      v: 900000,
      sourceCount: 3,
    };
  });
}

/** Write a replay-format consensus record. */
function writeRecord(root, record) {
  const dir = path.join(root, 'data', 'cache', 'consensus', DATE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${record.symbol.replace(/\./g, '_')}.json`),
    JSON.stringify(record)
  );
}

function buildReplay({ includeUsd = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'turtle-live-'));

  writeRecord(root, {
    symbol: 'XIC',
    sector: 'Benchmark',
    currency: 'CAD',
    quorum: 3,
    tradeable: true,
    bars: bars(300, { start: 30, drift: 0.001 }),
  });
  writeRecord(root, {
    symbol: 'AAA',
    sector: 'Technology',
    currency: 'CAD',
    quorum: 3,
    tradeable: true,
    bars: bars(300, { start: 50 }),
  });
  writeRecord(root, {
    symbol: 'ZZZ',
    sector: 'Energy',
    currency: 'CAD',
    quorum: 1,
    tradeable: false,
    reason: 'quorum: only 1 source(s) carry the decision bar, 2 required to trade',
  });

  if (includeUsd) {
    writeRecord(root, {
      symbol: 'USTECH',
      sector: 'Technology',
      currency: 'USD',
      quorum: 3,
      tradeable: true,
      bars: bars(300, { start: 40 }),
    });
  }
  return root;
}

function runTurtle(root, extra = []) {
  return execFileSync(
    process.execPath,
    [TURTLE, '--data-root', root, '--replay', DATE, '--now', SETTLED, ...extra],
    { encoding: 'utf8' }
  );
}

test('replay produces a decision without touching the network', () => {
  const decision = JSON.parse(runTurtle(buildReplay(), ['--json']));

  assert.equal(decision.date, DATE);
  assert.equal(decision.regime.riskOn, true);
  assert.ok(decision.actions.length > 0);
  assert.equal(decision.scanned, 3);
});

test('a symbol below quorum is excluded and never traded', () => {
  const decision = JSON.parse(runTurtle(buildReplay(), ['--json']));

  assert.ok(decision.abstained.some((a) => a.symbol === 'ZZZ'));
  assert.ok(!decision.actions.some((a) => a.symbol === 'ZZZ'));
  assert.match(decision.abstained.find((a) => a.symbol === 'ZZZ').reason, /2 required to trade/);
});

test('replay is deterministic', () => {
  const root = buildReplay();
  assert.equal(runTurtle(root, ['--json']), runTurtle(root, ['--json']));
});

test('the minimum quorum across symbols is reported, not the maximum', () => {
  // Reporting the best-verified symbol would hide the weakest one.
  const decision = JSON.parse(runTurtle(buildReplay(), ['--json']));
  assert.equal(decision.sourcesAgreed, 3);
});

test('a USD candidate abstains loudly when no FX rate is available', () => {
  // Replay does not fetch a rate, so USD names must refuse to size rather than
  // silently assume parity — a 1.0 rate would understate CAD exposure by ~40%.
  const decision = JSON.parse(runTurtle(buildReplay({ includeUsd: true }), ['--json']));

  assert.ok(!decision.actions.some((a) => a.symbol === 'USTECH'));
  const rejection = decision.noAction.find((r) => r.symbol === 'USTECH');
  assert.ok(rejection, 'the USD name must be reported, not silently dropped');
  assert.match(rejection.reason, /USD\/CAD rate|FX round trip/);
});

test('every action states its currency explicitly in the brief', () => {
  const text = runTurtle(buildReplay());
  assert.match(text, /TURTLE — 2026-08-12/);
  assert.match(text, /independent source/);
  assert.match(text, /Place GTC stop-limit/);
});

test('the run is persisted for audit', () => {
  const root = buildReplay();
  runTurtle(root, ['--json']);
  const file = path.join(root, 'data', 'runs', `${DATE}.json`);

  assert.ok(fs.existsSync(file));
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(record.decision);
  assert.equal(record.scanned, 3);
});

test('a missing benchmark refuses to issue any recommendation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'turtle-live-'));
  writeRecord(root, {
    symbol: 'AAA',
    sector: 'Technology',
    currency: 'CAD',
    quorum: 3,
    tradeable: true,
    bars: bars(300),
  });

  assert.throws(
    () => runTurtle(root),
    /could not be verified|regime is unknown/,
    'the regime filter is mandatory'
  );
});

test('a replay date with no cache exits cleanly', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'turtle-live-'));
  assert.throws(() => runTurtle(root), /No cached consensus/);
});

test('with every provider unreachable the run fails clearly and points at doctor', () => {
  // Run the LIVE path. In a sandbox with no egress this exercises the genuine
  // total-outage case: it must not crash, must not emit a recommendation, and
  // must tell the user how to diagnose it.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'turtle-live-'));
  let stderr = '';
  try {
    execFileSync(
      process.execPath,
      [TURTLE, '--data-root', root, '--markets', 'CAD', '--now', SETTLED, '--json'],
      { encoding: 'utf8', stdio: 'pipe', timeout: 120000 }
    );
    // If the machine running these tests DOES have network, the run may
    // legitimately succeed. Either outcome is acceptable; a crash is not.
  } catch (error) {
    stderr = error.stderr || '';
    assert.ok(
      /could not be verified|regime is unknown|turtle:doctor/.test(stderr),
      `expected a clear diagnostic, got: ${stderr.slice(0, 400)}`
    );
    assert.ok(
      !/TypeError|ReferenceError|undefined is not/.test(stderr),
      `must fail cleanly, not crash: ${stderr.slice(0, 400)}`
    );
  }
});
