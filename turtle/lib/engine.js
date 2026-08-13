'use strict';

const signals = require('./signals');
const sizing = require('./sizing');
const riskLib = require('./risk');
const fxLib = require('./fx');
const { rankCandidates } = require('./ranking');
const { projectPortfolio, conditionalExpectation } = require('./montecarlo');

/**
 * The decision engine.
 *
 * Every path into this system — the live fetch, a replay from cache, a test —
 * calls this one function. Two code paths that each decide what to trade would
 * eventually disagree, and the disagreement would surface as a recommendation
 * that cannot be reproduced.
 *
 * It is pure: given the same inputs it returns the same decision, with no clock,
 * no filesystem and no network access of its own.
 */

/** Currency-aware helper: everything the sizing layer needs for one symbol. */
function contextFor(symbol, meta, fxRate, config) {
  const currency = (meta[symbol] && meta[symbol].currency) || config.fx.accountCurrency;
  return {
    currency,
    sector: (meta[symbol] && meta[symbol].sector) || 'Unknown',
    rate: currency === config.fx.accountCurrency ? 1 : fxRate,
  };
}

function decide({
  date,
  verified,          // { symbol: bars[] } — consensus-verified only
  benchmarkBars,
  state,
  meta,              // { symbol: { sector, currency } }
  config,
  fxRate,
  backtest,
  abstained = [],
  warnings = [],
  quorumBySymbol = {},
}) {
  const regime = riskLib.evaluateRegime(benchmarkBars, config);

  const indicatorsBySymbol = {};
  const lastIndex = {};
  const priceBySymbol = {};   // in ACCOUNT currency, for heat and capital maths
  const localPrice = {};      // in the instrument's own currency

  for (const [symbol, bars] of Object.entries(verified)) {
    indicatorsBySymbol[symbol] = signals.computeIndicators(bars, config);
    lastIndex[symbol] = bars.length - 1;
    const ctx = contextFor(symbol, meta, fxRate, config);
    localPrice[symbol] = bars[bars.length - 1].c;
    priceBySymbol[symbol] = bars[bars.length - 1].c * ctx.rate;
  }

  const equity =
    state.cash +
    state.positions.reduce((sum, p) => {
      const ctx = contextFor(p.symbol, meta, fxRate, config);
      return sum + (localPrice[p.symbol] ?? p.avgPrice) * p.shares * ctx.rate;
    }, 0);

  const actions = [];
  const noAction = [];

  // ---- Open positions: exits first, then stop maintenance ----------------
  for (const position of state.positions) {
    const bars = verified[position.symbol];
    if (!bars) {
      warnings.push(
        `${position.symbol} is an open position but was not verified this run — its stop was NOT re-evaluated. Leave the resting order in place.`
      );
      continue;
    }
    const i = lastIndex[position.symbol];
    const indicators = indicatorsBySymbol[position.symbol];
    const n = indicators.atr[i];
    const close = bars[i].c;
    const ctx = contextFor(position.symbol, meta, fxRate, config);

    const exit = signals.evaluateExit(bars, indicators, i, position, config);
    if (exit.triggered) {
      const riskPerShare = position.avgPrice - position.initialStop;
      actions.push({
        type: 'SELL',
        symbol: position.symbol,
        currency: ctx.currency,
        shares: position.shares,
        reason: exit.reason,
        r: riskPerShare > 0 ? (close - position.avgPrice) / riskPerShare : null,
        pnl: (close - position.avgPrice) * position.shares * ctx.rate,
      });
      continue;
    }

    if (!(n > 0)) continue;
    const highestClose = Math.max(position.highestClose, close);
    const next = sizing.computeStop({
      lastFillPrice: position.lastFillPrice,
      highestCloseSinceEntry: highestClose,
      n,
      previousStop: position.stop,
      config,
    });

    if (next.stop > position.stop + 1e-9) {
      const riskPerShare = position.avgPrice - position.initialStop;
      actions.push({
        type: 'RAISE_STOP',
        symbol: position.symbol,
        currency: ctx.currency,
        from: position.stop,
        to: next.stop,
        limit: sizing.stopLimitPair(next.stop, n).limit,
        source: next.source,
        lockedR: riskPerShare > 0 ? (next.stop - position.avgPrice) / riskPerShare : 0,
      });
    }
  }

  // ---- Entry candidates --------------------------------------------------
  const candidates = [];
  for (const [symbol, bars] of Object.entries(verified)) {
    const i = lastIndex[symbol];
    const indicators = indicatorsBySymbol[symbol];
    const position = state.positions.find((p) => p.symbol === symbol);
    const ctx = contextFor(symbol, meta, fxRate, config);

    if (position) {
      if (position.units >= config.risk.maxUnitsPerName) continue;
      const n = indicators.atr[i];
      if (!(n > 0)) continue;
      const trigger = position.lastFillPrice + config.risk.pyramidSpacingN * n;
      if (bars[i].c < trigger) continue;
      candidates.push({
        symbol,
        sector: position.sector,
        currency: ctx.currency,
        fxRate: ctx.rate,
        indicators,
        index: i,
        snapshot: null,
        entry: { system: position.system, n, extensionN: 0 },
        isAdd: true,
        unit: position.units + 1,
      });
      continue;
    }

    const entry = signals.evaluateEntry(bars, indicators, i, config, state.symbolState[symbol] || {});
    if (!entry.triggered) {
      if (entry.reason && entry.reason !== 'no breakout') {
        noAction.push({ symbol, reason: entry.reason });
      }
      continue;
    }

    const quality = signals.evaluateQuality(indicators, i, config);
    if (!quality.passed) {
      noAction.push({ symbol, reason: `breakout but ${quality.reasons.join(', ')}` });
      continue;
    }

    candidates.push({
      symbol,
      sector: ctx.sector,
      currency: ctx.currency,
      fxRate: ctx.rate,
      indicators,
      index: i,
      snapshot: null,
      entry,
      isAdd: false,
      unit: 1,
    });
  }

  // ---- Rank, gate, size --------------------------------------------------
  const historicalTrades = backtest && backtest.gatePassed ? backtest.trades || [] : [];
  const simulated = state.positions.map((p) => ({ ...p }));
  const workingPrices = { ...priceBySymbol };

  for (const candidate of rankCandidates(candidates, config)) {
    const i = candidate.index;
    const bars = verified[candidate.symbol];
    const n = candidate.entry.n ?? candidate.indicators.atr[i];
    const maxPrice = sizing.maxEntryPrice(bars[i].c, n);

    // A foreign trade must clear its own currency cost before anything else.
    const expectation = historicalTrades.length
      ? conditionalExpectation({
          trades: historicalTrades,
          system: candidate.entry.system,
          efficiencyRatio: candidate.indicators.er[i],
          adx: candidate.indicators.adx[i],
        })
      : { ok: false, reason: 'no validated backtest available yet' };

    const hurdle = fxLib.passesFxHurdle({
      price: bars[i].c,
      n,
      currency: candidate.currency,
      config,
      expectedR: expectation.ok ? expectation.expectedR : null,
    });
    if (!hurdle.passed) {
      noAction.push({ symbol: candidate.symbol, reason: hurdle.reason });
      continue;
    }

    if (candidate.currency !== config.fx.accountCurrency && !(candidate.fxRate > 0)) {
      noAction.push({
        symbol: candidate.symbol,
        reason: `no USD/CAD rate available, so a ${candidate.currency} position cannot be sized`,
      });
      continue;
    }

    const size = sizing.computeUnitSize({
      equity,
      price: bars[i].c,
      maxPrice,
      n,
      config,
      riskMultiplier: regime.riskMultiplier,
      fxRate: candidate.fxRate,
    });
    if (!size.feasible) {
      noAction.push({ symbol: candidate.symbol, reason: size.reason });
      continue;
    }

    const gate = riskLib.gateCandidate({
      candidate: {
        symbol: candidate.symbol,
        sector: candidate.sector,
        plannedRisk: size.actualRisk,
        plannedNotional: size.notional,
      },
      positions: simulated,
      priceBySymbol: workingPrices,
      returnsBySymbol: {},
      equity,
      regime,
      config,
    });
    if (!gate.allowed) {
      noAction.push({ symbol: candidate.symbol, reason: gate.blockers.join('; ') });
      continue;
    }

    const stopPair = sizing.stopLimitPair(
      sizing.computeStop({
        lastFillPrice: maxPrice,
        highestCloseSinceEntry: maxPrice,
        n,
        previousStop: null,
        config,
      }).stop,
      n
    );

    actions.push({
      type: candidate.isAdd ? 'ADD' : 'BUY',
      symbol: candidate.symbol,
      currency: candidate.currency,
      shares: size.shares,
      maxPrice,
      notional: size.notional,
      notionalLocal: size.notionalLocal,
      n,
      unit: candidate.unit,
      maxUnits: config.risk.maxUnitsPerName,
      system: candidate.entry.system,
      risk: size.actualRisk,
      riskPct: size.actualRisk / equity,
      stop: stopPair.stop,
      limit: stopPair.limit,
      fxDragR: hurdle.drag,
      quorum: quorumBySymbol[candidate.symbol] ?? null,
      nextAdd:
        candidate.unit < config.risk.maxUnitsPerName
          ? sizing.money(maxPrice + config.risk.pyramidSpacingN * n)
          : null,
      expectation,
    });

    // Reserve this order's capital and heat so the next candidate is gated
    // against the book as it WOULD be, not as it is now.
    simulated.push({
      symbol: candidate.symbol,
      sector: candidate.sector,
      shares: size.shares,
      avgPrice: maxPrice * candidate.fxRate,
      stop: stopPair.stop * candidate.fxRate,
      units: candidate.unit,
    });
    workingPrices[candidate.symbol] = maxPrice * candidate.fxRate;
  }

  const heat = riskLib.portfolioHeat(state.positions, priceBySymbol, equity);
  const usage = riskLib.capitalUsage(state.positions, priceBySymbol, equity);

  if (backtest && !backtest.gatePassed) {
    warnings.push(
      'The latest walk-forward gate FAILED. Entry recommendations below are rule output, not validated edge — do not trade them until the gate passes.'
    );
  } else if (!backtest) {
    warnings.push(
      'No backtest has been run. Entry recommendations are unvalidated — run npm run turtle:backtest before trading live.'
    );
  }

  const quorums = Object.values(quorumBySymbol);
  return {
    date,
    equity: sizing.money(equity),
    deployed: usage.deployed,
    deployedPct: usage.deployedPct,
    heatPct: heat.pct,
    heatCapPct: config.risk.maxPortfolioHeatPct,
    sourcesAgreed: quorums.length ? Math.min(...quorums) : 0,
    fxRate,
    regime: { ...regime, benchmarkSymbol: config.regime.benchmarkSymbol },
    actions,
    noAction,
    abstained,
    warnings,
    forward:
      backtest && backtest.gatePassed
        ? projectPortfolio({ stats: backtest.stats, horizonDays: 60, config })
        : { ok: false, reason: 'no validated backtest to project from' },
  };
}

module.exports = { decide, contextFor };
