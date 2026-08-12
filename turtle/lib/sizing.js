'use strict';

/**
 * Position sizing, pyramiding, and stop placement.
 *
 * This is capital-constrained Turtle sizing. Classic Turtle sizing assumes a
 * futures account large enough that the risk-based share count is always
 * affordable. On a $10k book it frequently is not, so every size passes through
 * a notional cap and a feasibility check, and the function returns a REASON when
 * a trade is impossible rather than silently emitting a size that cannot be filled.
 */

const TICK = 0.01;

/** Round to the TSX penny tick. `dir` of 'up' or 'down' forces the direction. */
function roundTick(price, dir = 'nearest') {
  const ticks = price / TICK;
  if (dir === 'up') return Math.ceil(ticks - 1e-9) * TICK;
  if (dir === 'down') return Math.floor(ticks + 1e-9) * TICK;
  return Math.round(ticks) * TICK;
}

/** Strip binary floating-point dust before it reaches a dollar figure. */
function money(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Size one unit.
 *
 * Share count is derived from the 2N stop distance and is therefore INDEPENDENT
 * of fill price — a higher fill moves the stop up by the same amount, so risk per
 * share stays at 2N. The notional cap, however, is evaluated at `maxPrice` (the
 * worst price we would accept), so a position can never breach the cap on a
 * bad fill.
 */
function computeUnitSize({ equity, price, maxPrice, n, config, riskMultiplier = 1 }) {
  const r = config.risk;
  const effectiveRiskPct = r.riskPerUnitPct * riskMultiplier;
  const riskBudget = equity * effectiveRiskPct;
  const stopDistance = r.stopMultipleN * n;
  const cap = maxPrice || price;

  const base = {
    equity,
    price,
    maxPrice: cap,
    n,
    riskBudget: money(riskBudget),
    stopDistance,
    effectiveRiskPct,
  };

  if (!(n > 0)) {
    return { ...base, feasible: false, shares: 0, reason: 'N (ATR) unavailable or zero' };
  }

  const sharesByRisk = Math.floor(riskBudget / stopDistance);
  const notionalCap = equity * r.maxSingleNameNotionalPct;
  const sharesByNotional = Math.floor(notionalCap / cap);
  const shares = Math.min(sharesByRisk, sharesByNotional);

  const result = {
    ...base,
    sharesByRisk,
    sharesByNotional,
    notionalCap: money(notionalCap),
    shares,
    notional: money(shares * cap),
    actualRisk: money(shares * stopDistance),
    binding: sharesByRisk <= sharesByNotional ? 'risk' : 'notional',
  };

  if (shares < 1) {
    const reason = sharesByRisk < 1
      ? `1 share risks $${money(stopDistance)} which exceeds the $${money(riskBudget)} per-unit budget`
      : `1 share costs $${money(cap)} which exceeds the $${money(notionalCap)} single-name cap`;
    return { ...result, feasible: false, reason };
  }

  if (result.notional < r.minTicketValue) {
    return {
      ...result,
      feasible: false,
      reason: `position value $${result.notional} is below the $${r.minTicketValue} minimum ticket`,
    };
  }

  return { ...result, feasible: true, reason: null };
}

/**
 * Maximum price worth paying for a breakout entry.
 *
 * The signal fires on the close; execution happens at the next open. Half a unit
 * of N above the signal close is the widest slippage where the trade still
 * resembles the one that was backtested. Above that you are chasing a gap, and
 * the edge decays — so the recommendation is to skip, not to pay up.
 */
function maxEntryPrice(signalClose, n) {
  return money(roundTick(signalClose + 0.5 * n, 'down'));
}

/** Pyramid add-trigger prices: entry + 0.5N, entry + 1.0N, ... up to maxUnits. */
function pyramidLadder(firstFillPrice, n, config) {
  const r = config.risk;
  const rungs = [];
  for (let unit = 2; unit <= r.maxUnitsPerName; unit += 1) {
    rungs.push({
      unit,
      triggerPrice: money(roundTick(firstFillPrice + r.pyramidSpacingN * n * (unit - 1), 'up')),
    });
  }
  return rungs;
}

/**
 * The hard stop that rests at the broker.
 *
 * Two inputs compete and the HIGHER (tighter) one wins:
 *   - 2N below the most recent fill  — the classic Turtle stop, re-anchored on
 *     every pyramid add so all units share one stop
 *   - 2N below the highest close since entry — a Chandelier ratchet that converts
 *     open profit into locked profit as the trend extends
 *
 * The stop is never lowered. `previousStop` is passed in so a ratcheted stop
 * survives a pullback in the highest-close input.
 */
function computeStop({ lastFillPrice, highestCloseSinceEntry, n, previousStop, config }) {
  const distance = config.risk.stopMultipleN * n;
  const fromFill = lastFillPrice - distance;
  const fromTrail = highestCloseSinceEntry - distance;

  let stop = Math.max(fromFill, fromTrail);
  if (previousStop !== null && previousStop !== undefined) {
    stop = Math.max(stop, previousStop);
  }

  // Round UP so the realised stop distance is never wider than planned.
  return {
    stop: money(roundTick(stop, 'up')),
    fromFill: money(fromFill),
    fromTrail: money(fromTrail),
    ratcheted: previousStop !== null && previousStop !== undefined && stop > previousStop,
    source: fromTrail > fromFill ? 'chandelier-trail' : 'fill-anchored',
  };
}

/**
 * Convert a stop price into the stop-limit pair to enter on Wealthsimple.
 *
 * A pure stop-limit can be skipped entirely in a fast tape if the limit sits too
 * close to the trigger. The limit is therefore placed the LOOSER of 50bps or
 * 0.5N below the stop — wide enough to fill through a fast move, tight enough to
 * refuse a genuinely disorderly print.
 */
function stopLimitPair(stopPrice, n) {
  const byPct = stopPrice * 0.995;
  const byVol = stopPrice - 0.5 * n;
  return {
    stop: money(roundTick(stopPrice, 'up')),
    limit: money(roundTick(Math.min(byPct, byVol), 'down')),
  };
}

/**
 * Open risk of a live position, in dollars.
 * Once the stop sits above the current price the position carries locked profit,
 * not risk, so it floors at zero and stops consuming portfolio heat.
 */
function openRisk(position, currentPrice) {
  const perShare = Math.max(0, currentPrice - position.stop);
  return money(perShare * position.shares);
}

/** Express a closed or open P&L as an R-multiple of the trade's initial risk. */
function rMultiple({ entryPrice, exitPrice, initialStop, shares }) {
  const riskPerShare = entryPrice - initialStop;
  if (!(riskPerShare > 0)) return null;
  return ((exitPrice - entryPrice) * shares) / (riskPerShare * shares);
}

module.exports = {
  TICK,
  roundTick,
  money,
  computeUnitSize,
  maxEntryPrice,
  pyramidLadder,
  computeStop,
  stopLimitPair,
  openRisk,
  rMultiple,
};
