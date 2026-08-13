'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { money, rMultiple } = require('./sizing');

/**
 * Portfolio state: load, save, and reconcile against what the broker actually
 * shows.
 *
 * The system's model of your positions and Wealthsimple's record of them will
 * drift — an order fills partially, a limit never fills, a stop triggers
 * overnight, or a trade is placed by hand. Every one of those makes the model
 * wrong in a way that silently corrupts sizing, heat, and stop placement.
 *
 * So reconciliation NEVER auto-applies. It produces a diff and demands explicit
 * confirmation. A system that quietly overwrites its own state from an OCR'd
 * screenshot is one bad parse away from recommending a sell of a position you
 * do not hold.
 */

const STATE_VERSION = 1;

function emptyPortfolio(config) {
  return {
    version: STATE_VERSION,
    updatedAt: null,
    equity: config.account.equity,
    cash: config.account.equity,
    positions: [],
    symbolState: {},
    pendingOrders: [],
  };
}

function statePath(root) {
  return path.join(root, 'data', 'portfolio.json');
}

function loadPortfolio(root, config) {
  const file = statePath(root);
  if (!fs.existsSync(file)) return emptyPortfolio(config);

  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (state.version !== STATE_VERSION) {
    throw new Error(
      `portfolio.json is version ${state.version}, this build expects ${STATE_VERSION} — migrate deliberately rather than letting it be read as the wrong shape`
    );
  }
  return state;
}

function savePortfolio(root, state) {
  const file = statePath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2) + '\n'
  );
  return file;
}

/**
 * Diff the tracked positions against a parsed broker snapshot.
 *
 * `observed` is `[{ symbol, shares, avgPrice? }]` as read from the screenshot.
 * Share counts are compared exactly: a difference of one share usually means a
 * partial fill, which changes the correct stop and the correct pyramid trigger.
 */
function reconcile(state, observed, { shareTolerance = 0 } = {}) {
  const tracked = new Map(state.positions.map((p) => [p.symbol, p]));
  const seen = new Map(observed.map((p) => [p.symbol, p]));

  const matched = [];
  const shareMismatches = [];
  const untracked = [];
  const missing = [];

  for (const [symbol, obs] of seen) {
    const position = tracked.get(symbol);
    if (!position) {
      untracked.push({
        symbol,
        observedShares: obs.shares,
        note: 'held at the broker but not tracked — was this bought outside the system?',
      });
      continue;
    }
    const delta = obs.shares - position.shares;
    if (Math.abs(delta) > shareTolerance) {
      shareMismatches.push({
        symbol,
        trackedShares: position.shares,
        observedShares: obs.shares,
        delta,
        note:
          delta < 0
            ? 'fewer shares than tracked — a partial exit or a stop that already triggered'
            : 'more shares than tracked — an extra fill the system did not record',
      });
    } else {
      matched.push({ symbol, shares: obs.shares });
    }
  }

  for (const [symbol, position] of tracked) {
    if (!seen.has(symbol)) {
      missing.push({
        symbol,
        trackedShares: position.shares,
        note: 'tracked but absent at the broker — the position was closed, most likely by a resting stop',
      });
    }
  }

  const differences = shareMismatches.length + untracked.length + missing.length;
  return {
    clean: differences === 0,
    requiresConfirmation: differences > 0,
    matched,
    shareMismatches,
    untracked,
    missing,
    summary:
      differences === 0
        ? `all ${matched.length} tracked position(s) match the broker`
        : `${differences} difference(s) need confirmation before state is updated`,
  };
}

/**
 * Record a fill against the portfolio.
 *
 * Pyramid adds blend into the average price and re-anchor the stop; the first
 * fill establishes the initial stop that every R-multiple is later measured
 * against, so it is captured separately and never overwritten.
 */
function applyFill(state, fill) {
  const existing = state.positions.find((p) => p.symbol === fill.symbol);
  const cost = fill.price * fill.shares;

  if (!existing) {
    state.positions.push({
      symbol: fill.symbol,
      sector: fill.sector,
      system: fill.system,
      units: 1,
      shares: fill.shares,
      avgPrice: money(fill.price),
      firstFillPrice: money(fill.price),
      firstUnitShares: fill.shares,
      lastFillPrice: money(fill.price),
      initialStop: money(fill.stop),
      stop: money(fill.stop),
      highestClose: money(fill.price),
      entryDate: fill.date,
      entryEfficiencyRatio: fill.entryEfficiencyRatio ?? null,
      entryAdx: fill.entryAdx ?? null,
    });
  } else {
    const totalShares = existing.shares + fill.shares;
    existing.avgPrice = money(
      (existing.avgPrice * existing.shares + cost) / totalShares
    );
    existing.shares = totalShares;
    existing.units += 1;
    existing.lastFillPrice = money(fill.price);
    existing.stop = money(Math.max(existing.stop, fill.stop));
  }

  state.cash = money(state.cash - cost);
  return state;
}

/** Close a position and append it to the trade ledger. */
function applyExit(state, { symbol, price, date, reason }) {
  const index = state.positions.findIndex((p) => p.symbol === symbol);
  if (index === -1) {
    throw new Error(`cannot exit ${symbol}: not tracked as an open position`);
  }
  const position = state.positions[index];
  const proceeds = price * position.shares;

  const trade = {
    symbol,
    system: position.system,
    sector: position.sector,
    entryDate: position.entryDate,
    exitDate: date,
    entryPrice: position.avgPrice,
    firstFillPrice: position.firstFillPrice,
    exitPrice: money(price),
    shares: position.shares,
    units: position.units,
    initialStop: position.initialStop,
    pnl: money(proceeds - position.avgPrice * position.shares),
    r: rMultiple({
      entryPrice: position.avgPrice,
      exitPrice: price,
      initialStop: position.initialStop,
      shares: position.shares,
      firstFillPrice: position.firstFillPrice,
      firstUnitShares: position.firstUnitShares,
    }),
    exitReason: reason,
    entryEfficiencyRatio: position.entryEfficiencyRatio,
    entryAdx: position.entryAdx,
  };

  state.positions.splice(index, 1);
  state.cash = money(state.cash + proceeds);
  if (position.system === 1) {
    state.symbolState[symbol] = { lastSystem1Won: trade.r !== null && trade.r > 0 };
  }
  return trade;
}

/** Append a closed trade to the immutable ledger. */
function appendTrade(root, trade) {
  const file = path.join(root, 'data', 'trades.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ledger = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  ledger.push({ ...trade, recordedAt: new Date().toISOString() });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
  return ledger.length;
}

function loadTrades(root) {
  const file = path.join(root, 'data', 'trades.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

/** Persist the complete record of a run so any past recommendation is auditable. */
function saveRun(root, date, record) {
  const file = path.join(root, 'data', 'runs', `${date}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  return file;
}

module.exports = {
  STATE_VERSION,
  emptyPortfolio,
  loadPortfolio,
  savePortfolio,
  reconcile,
  applyFill,
  applyExit,
  appendTrade,
  loadTrades,
  saveRun,
};
