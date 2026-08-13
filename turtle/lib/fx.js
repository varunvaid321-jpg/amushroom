'use strict';

const { fetchJson, fetchText } = require('./http');

/**
 * Currency handling for a CAD account that also trades US listings.
 *
 * The account is denominated in CAD. US positions are sized, capped and risked
 * in CAD, while their prices, ATR and stops stay in USD — mixing those up is the
 * classic way to end up with a position 40% larger than intended.
 *
 * The important idea here is expressing FX cost in R.
 *
 * Wealthsimple charges roughly 1.5% converting CAD to USD and 1.5% coming back,
 * so a US round trip costs about 3% of notional. Comparing that 3% against an
 * expected RETURN is meaningless — what matters is its size relative to the risk
 * being taken. A stock with a 2N stop of 8% of price loses 3/8 = 0.375R to
 * currency before the trade does anything. That is a direct, quantified haircut
 * on expectancy, and it is why a US name must clear a visibly higher bar than a
 * TSX name to be worth taking.
 *
 * With a USD account funded once, the cost is a single conversion, and names
 * already held in USD cost nothing further.
 */

/** Round-trip conversion cost as a fraction of notional. */
function roundTripCostPct(currency, config) {
  const fx = config.fx;
  if (currency === fx.accountCurrency) return 0;
  // A USD account converts once on funding rather than on every trade.
  return fx.usdAccount ? fx.conversionCostPct : fx.conversionCostPct * 2;
}

/**
 * FX cost expressed in units of the trade's own risk.
 *
 * fxDragR = (round-trip cost x entry price) / (2N)
 *
 * Both numerator and denominator are in the instrument's local currency, so the
 * currency cancels and the result is directly comparable to an expectancy in R.
 */
function fxDragR({ price, n, currency, config }) {
  const cost = roundTripCostPct(currency, config);
  if (cost === 0) return 0;
  const stopDistance = config.risk.stopMultipleN * n;
  if (!(stopDistance > 0)) return Infinity;
  return (cost * price) / stopDistance;
}

/** Convert an amount in `currency` into the account currency. */
function toAccountCurrency(amount, currency, rate, config) {
  if (currency === config.fx.accountCurrency) return amount;
  if (!(rate > 0)) throw new Error(`no FX rate available to convert ${currency}`);
  return amount * rate;
}

/**
 * Is a foreign trade worth its currency cost?
 *
 * Rejected when the FX haircut consumes more than the configured share of the
 * edge the system expects to earn per trade.
 */
function passesFxHurdle({ price, n, currency, config, expectedR }) {
  const drag = fxDragR({ price, n, currency, config });
  if (drag === 0) return { passed: true, drag: 0 };

  const baseline = Number.isFinite(expectedR) && expectedR > 0
    ? expectedR
    : config.fx.assumedExpectancyR;
  const maxDrag = baseline * config.fx.maxDragShareOfEdge;

  return {
    passed: drag <= maxDrag,
    drag,
    maxDrag,
    reason:
      drag <= maxDrag
        ? null
        : `FX round trip costs ${drag.toFixed(2)}R, more than ${(config.fx.maxDragShareOfEdge * 100).toFixed(0)}% of the ${baseline.toFixed(2)}R expected edge`,
  };
}

/**
 * Fetch USD/CAD from several sources, taking the first that answers.
 *
 * Unlike price bars, an FX rate does not need consensus verification: it scales
 * position size rather than triggering a signal, and every liquid source agrees
 * to well within the tolerances that matter here. It does need a fallback, which
 * is why more than one is tried.
 */
async function fetchUsdCadRate({ timeoutMs = 10000 } = {}) {
  const attempts = [];

  const yahooSymbols = ['USDCAD=X', 'CAD=X'];
  for (const symbol of yahooSymbols) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const response = await fetchJson(url, { timeoutMs, retries: 1 });
    if (response.ok) {
      const result = response.json?.chart?.result?.[0];
      const closes = result?.indicators?.quote?.[0]?.close?.filter(Number.isFinite);
      const rate = closes?.[closes.length - 1] ?? result?.meta?.regularMarketPrice;
      if (Number.isFinite(rate) && rate > 0.5 && rate < 3) {
        return { ok: true, rate, source: `yahoo:${symbol}`, attempts };
      }
    }
    attempts.push({ source: `yahoo:${symbol}`, error: response.error || 'no usable rate' });
  }

  const stooq = await fetchText('https://stooq.com/q/d/l/?s=usdcad&i=d', { timeoutMs, retries: 1 });
  if (stooq.ok) {
    const lines = stooq.body.trim().split(/\r?\n/);
    const lastRow = lines[lines.length - 1]?.split(',');
    const rate = Number(lastRow?.[4]);
    if (Number.isFinite(rate) && rate > 0.5 && rate < 3) {
      return { ok: true, rate, source: 'stooq:usdcad', attempts };
    }
  }
  attempts.push({ source: 'stooq:usdcad', error: stooq.error || 'no usable rate' });

  return {
    ok: false,
    attempts,
    error: 'no FX source returned a usable USD/CAD rate',
  };
}

module.exports = {
  roundTripCostPct,
  fxDragR,
  toAccountCurrency,
  passesFxHurdle,
  fetchUsdCadRate,
};
