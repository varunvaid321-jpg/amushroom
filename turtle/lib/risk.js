'use strict';

const ind = require('./indicators');
const { openRisk, money } = require('./sizing');

/**
 * Portfolio-level risk governors and the market regime filter.
 *
 * Every governor here can only ever REMOVE a trade from the recommendation set.
 * Nothing in this file can add one, raise a size, or loosen a stop. That
 * asymmetry is deliberate: a bug in this file should make the system too
 * cautious, never too aggressive.
 */

/**
 * Market regime, computed from the TSX benchmark (XIC).
 *
 * Long-only trend following is the same trade as "own equities" during a bear
 * market, so the 200-day filter is not a refinement — it is the only thing
 * standing between this system and riding a full index drawdown to the bottom.
 *
 * A second, independent brake halves risk when realised volatility is in its top
 * decile: high-vol regimes produce wider stops, more whipsaws, and correlated
 * losses across every name at once.
 */
function evaluateRegime(benchmarkBars, config) {
  const cfg = config.regime;
  const closes = benchmarkBars.map((b) => b.c);
  const smaSeries = ind.sma(closes, cfg.smaPeriod);
  const i = benchmarkBars.length - 1;
  const sma200 = smaSeries[i];
  const close = closes[i];

  if (sma200 === null) {
    return {
      known: false,
      riskOn: false,
      riskMultiplier: 0,
      reasons: [
        `insufficient benchmark history: need ${cfg.smaPeriod} bars, have ${benchmarkBars.length}`,
      ],
    };
  }

  const volSeries = ind.realizedVolatility(closes, cfg.volLookback);
  const currentVol = volSeries[i];
  const window = volSeries.slice(Math.max(0, i - cfg.volPercentileWindow + 1), i + 1);
  const volThreshold = ind.percentile(window, cfg.highVolPercentile);

  const trendUp = close > sma200;
  const highVol =
    currentVol !== null && volThreshold !== null && currentVol > volThreshold;

  const reasons = [];
  if (!trendUp) {
    reasons.push(
      `${cfg.benchmarkSymbol} close ${close.toFixed(2)} is below its ${cfg.smaPeriod}-day SMA ${sma200.toFixed(2)} — no new entries`
    );
  }
  if (highVol) {
    reasons.push(
      `${cfg.benchmarkSymbol} ${cfg.volLookback}-day realised vol ${(currentVol * 100).toFixed(1)}% is above the ${cfg.highVolPercentile * 100}th percentile (${(volThreshold * 100).toFixed(1)}%) — risk halved`
    );
  }

  return {
    known: true,
    riskOn: trendUp,
    highVol,
    close,
    sma200,
    distanceToSmaPct: (close / sma200 - 1) * 100,
    realizedVol: currentVol,
    volThreshold,
    riskMultiplier: trendUp ? (highVol ? cfg.highVolRiskMultiplier : 1) : 0,
    reasons,
  };
}

/** Total open risk across the book, as a fraction of equity. */
function portfolioHeat(positions, priceBySymbol, equity) {
  let total = 0;
  const breakdown = [];
  for (const position of positions) {
    const price = priceBySymbol[position.symbol];
    if (price === undefined) continue;
    const risk = openRisk(position, price);
    total += risk;
    breakdown.push({ symbol: position.symbol, risk, shares: position.shares });
  }
  return { dollars: money(total), pct: equity > 0 ? total / equity : 0, breakdown };
}

/** Deployed capital and remaining cash buffer. */
function capitalUsage(positions, priceBySymbol, equity) {
  let deployed = 0;
  for (const position of positions) {
    const price = priceBySymbol[position.symbol] ?? position.avgPrice;
    deployed += price * position.shares;
  }
  return {
    deployed: money(deployed),
    deployedPct: equity > 0 ? deployed / equity : 0,
    cash: money(equity - deployed),
    cashPct: equity > 0 ? (equity - deployed) / equity : 0,
  };
}

/**
 * Run every governor against one candidate.
 *
 * Returns ALL blockers rather than short-circuiting on the first, so the daily
 * brief can tell you exactly why a name was rejected instead of surfacing one
 * reason and hiding the rest.
 */
function gateCandidate({
  candidate,
  positions,
  priceBySymbol,
  returnsBySymbol,
  equity,
  regime,
  config,
}) {
  const r = config.risk;
  const blockers = [];
  const existing = positions.find((p) => p.symbol === candidate.symbol);

  if (!regime.known) {
    blockers.push('market regime unknown (insufficient benchmark history)');
  } else if (!regime.riskOn) {
    blockers.push(regime.reasons[0]);
  }

  if (existing && existing.units >= r.maxUnitsPerName) {
    blockers.push(
      `already holding the maximum ${r.maxUnitsPerName} units of ${candidate.symbol}`
    );
  }

  // Sector concentration. The TSX is dominated by financials, energy and
  // materials, so without this cap a "diversified" book is really one macro bet.
  if (!existing) {
    const sectorCount = positions.filter((p) => p.sector === candidate.sector).length;
    if (sectorCount >= r.maxPositionsPerSector) {
      blockers.push(
        `sector cap: already holding ${sectorCount} ${candidate.sector} position(s), limit is ${r.maxPositionsPerSector}`
      );
    }
  }

  const heat = portfolioHeat(positions, priceBySymbol, equity);
  const projectedHeat = heat.dollars + candidate.plannedRisk;
  if (projectedHeat / equity > r.maxPortfolioHeatPct) {
    blockers.push(
      `portfolio heat would reach ${((projectedHeat / equity) * 100).toFixed(2)}%, above the ${(r.maxPortfolioHeatPct * 100).toFixed(1)}% cap`
    );
  }

  const usage = capitalUsage(positions, priceBySymbol, equity);
  const projectedCash = usage.cash - candidate.plannedNotional;
  if (projectedCash / equity < r.minCashBufferPct) {
    blockers.push(
      `cash buffer would fall to ${((projectedCash / equity) * 100).toFixed(1)}%, below the ${(r.minCashBufferPct * 100).toFixed(0)}% minimum`
    );
  }

  // Correlation. Two names at 0.85 correlation are one position with two tickers,
  // and the heat cap alone would happily let you take both.
  const candidateReturns = returnsBySymbol[candidate.symbol];
  if (candidateReturns && !existing) {
    for (const position of positions) {
      const other = returnsBySymbol[position.symbol];
      if (!other) continue;
      const rho = ind.correlation(candidateReturns, other);
      if (rho !== null && rho > r.correlationBlockThreshold) {
        if (projectedHeat / equity > r.correlationHeatCeilingPct) {
          blockers.push(
            `correlation ${rho.toFixed(2)} with ${position.symbol} exceeds ${r.correlationBlockThreshold} and heat would reach ${((projectedHeat / equity) * 100).toFixed(2)}%, above the ${(r.correlationHeatCeilingPct * 100).toFixed(1)}% correlated-book ceiling`
          );
        }
      }
    }
  }

  return {
    symbol: candidate.symbol,
    allowed: blockers.length === 0,
    blockers,
    isPyramidAdd: Boolean(existing),
    heatBefore: heat.pct,
    heatAfter: projectedHeat / equity,
  };
}

module.exports = {
  evaluateRegime,
  portfolioHeat,
  capitalUsage,
  gateCandidate,
};
