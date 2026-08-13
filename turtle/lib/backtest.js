'use strict';

const signals = require('./signals');
const sizing = require('./sizing');
const riskLib = require('./risk');
const { rankCandidates } = require('./ranking');

/**
 * Event-driven backtester.
 *
 * The execution sequence within each session is the honest one, and it is the
 * whole reason to write a backtester rather than vectorise the rules:
 *
 *   1. OPEN    — fill orders that were decided at the previous close
 *   2. INTRADAY— resting stops and pyramid triggers can be hit
 *   3. CLOSE   — evaluate signals, which become tomorrow's orders
 *
 * A signal generated on a close can therefore never be filled at that same
 * close. Any backtest that allows it manufactures returns that cannot be earned.
 */

/** Apply round-trip friction. Wealthsimple charges no commission; spread is real. */
function applyCosts(price, side, config) {
  const bps = (config.costs.assumedHalfSpreadBps + config.costs.assumedImpactBps) / 10000;
  return side === 'buy' ? price * (1 + bps) : price * (1 - bps);
}

/** Sorted union of every session date across the supplied symbols. */
function buildCalendar(barsBySymbol, benchmarkBars) {
  const dates = new Set(benchmarkBars.map((b) => b.t.slice(0, 10)));
  for (const bars of Object.values(barsBySymbol)) {
    for (const bar of bars) dates.add(bar.t.slice(0, 10));
  }
  return [...dates].sort();
}

function indexByDate(bars) {
  const map = new Map();
  bars.forEach((bar, i) => map.set(bar.t.slice(0, 10), i));
  return map;
}

/**
 * Run the strategy over a date range.
 *
 * `fromDate`/`toDate` bound the TRADING window, but indicators are computed over
 * the full supplied history so a walk-forward fold starts with warmed-up
 * channels instead of 55 blind sessions.
 */
function runBacktest({
  barsBySymbol,
  benchmarkBars,
  sectorBySymbol,
  config,
  fromDate,
  toDate,
  startEquity = config.account.equity,
}) {
  const symbols = Object.keys(barsBySymbol);
  const indicatorsBySymbol = {};
  const indexBySymbol = {};
  for (const symbol of symbols) {
    indicatorsBySymbol[symbol] = signals.computeIndicators(barsBySymbol[symbol], config);
    indexBySymbol[symbol] = indexByDate(barsBySymbol[symbol]);
  }
  const benchmarkIndex = indexByDate(benchmarkBars);

  const calendar = buildCalendar(barsBySymbol, benchmarkBars).filter(
    (d) => (!fromDate || d >= fromDate) && (!toDate || d <= toDate)
  );

  let cash = startEquity;
  const positions = new Map();
  const symbolState = {}; // whipsaw memory, per symbol
  const trades = [];
  const equityCurve = [];
  let pendingOrders = [];

  const barOn = (symbol, date) => {
    const i = indexBySymbol[symbol].get(date);
    return i === undefined ? null : barsBySymbol[symbol][i];
  };

  const markToMarket = (date) => {
    let value = cash;
    for (const position of positions.values()) {
      const bar = barOn(position.symbol, date);
      value += (bar ? bar.c : position.lastPrice) * position.shares;
    }
    return value;
  };

  const closeTrade = (position, exitPrice, date, reason) => {
    const proceeds = applyCosts(exitPrice, 'sell', config) * position.shares;
    cash += proceeds;

    const r = sizing.rMultiple({
      entryPrice: position.avgPrice,
      exitPrice: applyCosts(exitPrice, 'sell', config),
      initialStop: position.initialStop,
      shares: position.shares,
    });

    trades.push({
      symbol: position.symbol,
      system: position.system,
      sector: position.sector,
      entryDate: position.entryDate,
      exitDate: date,
      // avgPrice is the blended cost across all pyramid units; firstFillPrice is
      // the original breakout entry. R is measured against the blended entry, so
      // a pyramided position is scored as the single trade it actually was.
      entryPrice: position.avgPrice,
      firstFillPrice: position.firstFillPrice,
      exitPrice,
      shares: position.shares,
      units: position.units,
      initialStop: position.initialStop,
      pnl: proceeds - position.costBasis,
      r,
      holdingDays: position.holdingDays,
      exitReason: reason,
      maxFavorableR: position.maxFavorableR,
      entryEfficiencyRatio: position.entryEfficiencyRatio,
      entryAdx: position.entryAdx,
    });

    // Whipsaw memory: only System 1 outcomes gate future System 1 entries.
    if (position.system === 1) {
      symbolState[position.symbol] = { lastSystem1Won: r !== null && r > 0 };
    }
    positions.delete(position.symbol);
  };

  for (const date of calendar) {
    // ---- 1. OPEN: fill yesterday's decisions -------------------------------
    for (const order of pendingOrders) {
      const bar = barOn(order.symbol, date);
      if (!bar) continue;

      if (order.kind === 'exit') {
        const position = positions.get(order.symbol);
        if (position) closeTrade(position, bar.o, date, order.reason);
        continue;
      }

      // A gap beyond the maximum acceptable price is a skipped trade, not a
      // chased one. This is where a large share of backtest overstatement hides.
      if (bar.o > order.maxPrice) continue;

      const fillPrice = applyCosts(bar.o, 'buy', config);
      const cost = fillPrice * order.shares;
      if (cost > cash) continue;

      cash -= cost;
      const existing = positions.get(order.symbol);
      if (existing) {
        const totalShares = existing.shares + order.shares;
        existing.avgPrice = (existing.avgPrice * existing.shares + fillPrice * order.shares) / totalShares;
        existing.shares = totalShares;
        existing.costBasis += cost;
        existing.units += 1;
        existing.lastFillPrice = fillPrice;
        existing.stop = sizing.computeStop({
          lastFillPrice: fillPrice,
          highestCloseSinceEntry: existing.highestClose,
          n: order.n,
          previousStop: existing.stop,
          config,
        }).stop;
      } else {
        const initialStop = sizing.computeStop({
          lastFillPrice: fillPrice,
          highestCloseSinceEntry: fillPrice,
          n: order.n,
          previousStop: null,
          config,
        }).stop;
        positions.set(order.symbol, {
          symbol: order.symbol,
          sector: order.sector,
          system: order.system,
          units: 1,
          shares: order.shares,
          avgPrice: fillPrice,
          lastFillPrice: fillPrice,
          costBasis: cost,
          firstFillPrice: fillPrice,
          initialStop,
          stop: initialStop,
          highestClose: fillPrice,
          entryDate: date,
          holdingDays: 0,
          maxFavorableR: 0,
          lastPrice: fillPrice,
          entryEfficiencyRatio: order.entryEfficiencyRatio,
          entryAdx: order.entryAdx,
        });
      }
    }
    pendingOrders = [];

    // ---- 2. INTRADAY: stops fire before anything else ----------------------
    for (const position of [...positions.values()]) {
      const bar = barOn(position.symbol, date);
      if (!bar) continue;
      const hit = signals.evaluateStopHit(bar, position.stop);
      if (hit.triggered) closeTrade(position, hit.fillPrice, date, hit.reason);
    }

    // ---- 3. CLOSE: update state and decide tomorrow's orders ---------------
    const priceBySymbol = {};
    for (const position of positions.values()) {
      const bar = barOn(position.symbol, date);
      if (!bar) continue;

      position.holdingDays += 1;
      position.lastPrice = bar.c;
      position.highestClose = Math.max(position.highestClose, bar.c);
      priceBySymbol[position.symbol] = bar.c;

      const riskPerShare = position.avgPrice - position.initialStop;
      if (riskPerShare > 0) {
        position.maxFavorableR = Math.max(
          position.maxFavorableR,
          (position.highestClose - position.avgPrice) / riskPerShare
        );
      }

      const n = indicatorsBySymbol[position.symbol].atr[indexBySymbol[position.symbol].get(date)];
      if (n > 0) {
        position.stop = sizing.computeStop({
          lastFillPrice: position.lastFillPrice,
          highestCloseSinceEntry: position.highestClose,
          n,
          previousStop: position.stop,
          config,
        }).stop;
      }

      const i = indexBySymbol[position.symbol].get(date);
      const exit = signals.evaluateExit(
        barsBySymbol[position.symbol],
        indicatorsBySymbol[position.symbol],
        i,
        position,
        config
      );
      if (exit.triggered) {
        pendingOrders.push({ kind: 'exit', symbol: position.symbol, reason: exit.reason });
      }
    }

    const equity = markToMarket(date);
    equityCurve.push({ date, equity, cash, openPositions: positions.size });

    const benchIdx = benchmarkIndex.get(date);
    if (benchIdx === undefined || benchIdx < config.regime.smaPeriod) continue;
    const regime = riskLib.evaluateRegime(benchmarkBars.slice(0, benchIdx + 1), config);
    if (!regime.riskOn) continue;

    // Gather entry candidates: new breakouts and pyramid adds alike.
    const candidates = [];
    for (const symbol of symbols) {
      const i = indexBySymbol[symbol].get(date);
      if (i === undefined) continue;

      const position = positions.get(symbol);
      if (position && position.units >= config.risk.maxUnitsPerName) continue;

      const indicators = indicatorsBySymbol[symbol];
      const bars = barsBySymbol[symbol];

      if (position) {
        // Pyramid: add at 0.5N above the last fill, evaluated on the close.
        const n = indicators.atr[i];
        if (!(n > 0)) continue;
        const trigger = position.lastFillPrice + config.risk.pyramidSpacingN * n;
        if (bars[i].c < trigger) continue;
        candidates.push({
          symbol,
          sector: position.sector,
          indicators,
          index: i,
          snapshot: null,
          entry: { system: position.system, n, extensionN: 0 },
          isAdd: true,
        });
        continue;
      }

      const entry = signals.evaluateEntry(bars, indicators, i, config, symbolState[symbol] || {});
      if (!entry.triggered) continue;
      const quality = signals.evaluateQuality(indicators, i, config);
      if (!quality.passed) continue;

      candidates.push({
        symbol,
        sector: sectorBySymbol[symbol] || 'Unknown',
        indicators,
        index: i,
        snapshot: null,
        entry,
        isAdd: false,
      });
    }

    if (candidates.length === 0) continue;

    for (const candidate of rankCandidates(candidates, config)) {
      const i = candidate.index;
      const bars = barsBySymbol[candidate.symbol];
      const n = candidate.entry.n ?? candidate.indicators.atr[i];
      const maxPrice = sizing.maxEntryPrice(bars[i].c, n);

      const size = sizing.computeUnitSize({
        equity,
        price: bars[i].c,
        maxPrice,
        n,
        config,
        riskMultiplier: regime.riskMultiplier,
      });
      if (!size.feasible) continue;

      const gate = riskLib.gateCandidate({
        candidate: {
          symbol: candidate.symbol,
          sector: candidate.sector,
          plannedRisk: size.actualRisk,
          plannedNotional: size.notional,
        },
        positions: [...positions.values()],
        priceBySymbol,
        returnsBySymbol: {},
        equity,
        regime,
        config,
      });
      if (!gate.allowed) continue;

      pendingOrders.push({
        kind: 'entry',
        symbol: candidate.symbol,
        sector: candidate.sector,
        system: candidate.entry.system,
        shares: size.shares,
        maxPrice,
        n,
        entryEfficiencyRatio: candidate.indicators.er[i],
        entryAdx: candidate.indicators.adx[i],
      });
    }
  }

  // Close anything still open at the final mark so statistics are complete.
  const lastDate = calendar[calendar.length - 1];
  for (const position of [...positions.values()]) {
    const bar = barOn(position.symbol, lastDate);
    if (bar) closeTrade(position, bar.c, lastDate, 'end of backtest window');
  }

  return { trades, equityCurve, stats: summarise(trades, equityCurve, startEquity) };
}

/** Maximum peak-to-trough decline on the equity curve. */
function maxDrawdown(equityCurve) {
  let peak = -Infinity;
  let worst = 0;
  let worstDate = null;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = peak > 0 ? (peak - point.equity) / peak : 0;
    if (dd > worst) {
      worst = dd;
      worstDate = point.date;
    }
  }
  return { pct: worst, date: worstDate };
}

function summarise(trades, equityCurve, startEquity) {
  const closed = trades.filter((t) => t.r !== null);
  const wins = closed.filter((t) => t.r > 0);
  const losses = closed.filter((t) => t.r <= 0);

  const sum = (arr, key) => arr.reduce((acc, t) => acc + t[key], 0);
  const mean = (arr, key) => (arr.length ? sum(arr, key) / arr.length : 0);
  const median = (arr, key) => {
    if (arr.length === 0) return 0;
    const sorted = arr.map((t) => t[key]).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const grossWin = sum(wins, 'pnl');
  const grossLoss = Math.abs(sum(losses, 'pnl'));
  const finalEquity = equityCurve.length ? equityCurve[equityCurve.length - 1].equity : startEquity;
  const dd = maxDrawdown(equityCurve);

  // Trading-day count is the honest denominator here: the curve only advances
  // on sessions, so annualising on calendar days would overstate the period.
  const years = equityCurve.length / 252;

  return {
    tradeCount: closed.length,
    winRate: closed.length ? wins.length / closed.length : 0,
    expectancyR: mean(closed, 'r'),
    avgWinR: mean(wins, 'r'),
    avgLossR: mean(losses, 'r'),
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    totalReturnPct: startEquity > 0 ? finalEquity / startEquity - 1 : 0,
    cagrPct: years > 0 && startEquity > 0 ? Math.pow(finalEquity / startEquity, 1 / years) - 1 : 0,
    maxDrawdownPct: dd.pct,
    maxDrawdownDate: dd.date,
    finalEquity,
    medianHoldWinners: median(wins, 'holdingDays'),
    medianHoldLosers: median(losses, 'holdingDays'),
    rMultiples: closed.map((t) => t.r),
    sessions: equityCurve.length,
  };
}

/**
 * Walk-forward validation.
 *
 * A single backtest over one period says almost nothing — with enough
 * parameters, any period can be fit. Splitting into sequential folds and
 * requiring EVERY fold to clear the gate is what separates an edge from a
 * curve-fit. Folds share warmed-up history but never share trading windows.
 */
function walkForward({ barsBySymbol, benchmarkBars, sectorBySymbol, config }) {
  const calendar = buildCalendar(barsBySymbol, benchmarkBars);
  const folds = config.backtestGate.walkForwardFolds;
  const size = Math.floor(calendar.length / folds);
  const results = [];

  for (let f = 0; f < folds; f += 1) {
    const fromDate = calendar[f * size];
    const toDate = f === folds - 1 ? calendar[calendar.length - 1] : calendar[(f + 1) * size - 1];
    const run = runBacktest({
      barsBySymbol,
      benchmarkBars,
      sectorBySymbol,
      config,
      fromDate,
      toDate,
    });
    results.push({ fold: f + 1, fromDate, toDate, stats: run.stats, trades: run.trades });
  }
  return results;
}

/**
 * The go/no-go gate.
 *
 * Every criterion must hold in every fold. A strategy that works in two folds
 * out of three is a strategy that does not work — the failing fold is the
 * market telling you which regime breaks it.
 */
function evaluateGate(foldResults, config) {
  const gate = config.backtestGate;
  const criteria = [];

  for (const fold of foldResults) {
    const s = fold.stats;
    criteria.push(
      {
        fold: fold.fold,
        name: 'expectancy',
        value: s.expectancyR,
        threshold: gate.minExpectancyR,
        passed: s.expectancyR >= gate.minExpectancyR,
      },
      {
        fold: fold.fold,
        name: 'profitFactor',
        value: s.profitFactor,
        threshold: gate.minProfitFactor,
        passed: s.profitFactor >= gate.minProfitFactor,
      },
      {
        fold: fold.fold,
        name: 'maxDrawdown',
        value: s.maxDrawdownPct,
        threshold: gate.maxDrawdownPct,
        passed: s.maxDrawdownPct <= gate.maxDrawdownPct,
      },
      {
        fold: fold.fold,
        name: 'tradeCount',
        value: s.tradeCount,
        threshold: 10,
        passed: s.tradeCount >= 10, // too few trades is an unmeasured strategy
      }
    );
  }

  const failed = criteria.filter((c) => !c.passed);
  return { passed: failed.length === 0, criteria, failed };
}

module.exports = {
  applyCosts,
  buildCalendar,
  runBacktest,
  maxDrawdown,
  summarise,
  walkForward,
  evaluateGate,
};
