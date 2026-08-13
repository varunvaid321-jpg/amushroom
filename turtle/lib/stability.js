'use strict';

const ind = require('./indicators');

/**
 * Ticker stability screening.
 *
 * Trend following does not need exciting names — it needs names whose trends are
 * real and whose risk can be measured. A stock that routinely gaps 20% overnight
 * breaks the core assumption the whole system rests on: that a 2N stop is a
 * meaningful boundary. When price can jump straight through it, the "0.75% risk
 * per unit" figure is fiction, and every downstream number built on it is too.
 *
 * So the screen rejects instability rather than ranking it, and every rejection
 * names the measurement that failed. All thresholds live in config.json — none
 * are decided at runtime.
 */

/** Fraction of sessions whose open gapped more than `threshold` from the prior close. */
function gapFrequency(bars, threshold) {
  let gaps = 0;
  for (let i = 1; i < bars.length; i += 1) {
    const prevClose = bars[i - 1].c;
    if (!(prevClose > 0)) continue;
    if (Math.abs(bars[i].o / prevClose - 1) > threshold) gaps += 1;
  }
  return bars.length > 1 ? gaps / (bars.length - 1) : 0;
}

/** Largest absolute close-to-close move in the window. */
function maxDailyMove(bars) {
  let worst = 0;
  for (let i = 1; i < bars.length; i += 1) {
    const prevClose = bars[i - 1].c;
    if (!(prevClose > 0)) continue;
    worst = Math.max(worst, Math.abs(bars[i].c / prevClose - 1));
  }
  return worst;
}

/** Sessions with no trading at all — a sign of a halt or a thin, unreliable listing. */
function zeroVolumeSessions(bars) {
  return bars.filter((b) => !(b.v > 0)).length;
}

/** Median dollar volume, which resists the single blowout day that a mean does not. */
function medianDollarVolume(bars) {
  const values = bars.map((b) => b.c * b.v).sort((a, b) => a - b);
  if (values.length === 0) return 0;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

/**
 * Longest run of sessions with an identical close.
 *
 * A repeated close usually means a stale or carried-forward price rather than a
 * genuinely unchanged market, and stale prices produce phantom breakouts when
 * they finally update.
 */
function longestFlatRun(bars) {
  let longest = 0;
  let run = 0;
  for (let i = 1; i < bars.length; i += 1) {
    if (bars[i].c === bars[i - 1].c) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return longest;
}

/**
 * Screen a symbol for stability.
 *
 * Returns every failure rather than the first, so the report explains a symbol
 * fully instead of one reason at a time.
 */
function screen(symbol, bars, config) {
  const cfg = config.stability;
  const failures = [];
  const metrics = {};

  if (!bars || bars.length === 0) {
    return { symbol, stable: false, metrics, failures: ['no bars available'] };
  }

  metrics.listingDays = bars.length;
  if (bars.length < cfg.minListingDays) {
    failures.push(
      `only ${bars.length} sessions of history, ${cfg.minListingDays} required — too new to characterise`
    );
  }

  const window = bars.slice(-cfg.windowDays);
  const closes = window.map((b) => b.c);
  const last = window[window.length - 1];

  metrics.price = last.c;
  if (last.c < cfg.minPrice) {
    failures.push(`price ${last.c.toFixed(2)} is below the ${cfg.minPrice} floor`);
  }

  const volSeries = ind.realizedVolatility(closes, Math.min(60, closes.length - 1));
  metrics.annualisedVol = volSeries[volSeries.length - 1];
  if (Number.isFinite(metrics.annualisedVol) && metrics.annualisedVol > cfg.maxAnnualisedVol) {
    failures.push(
      `annualised volatility ${(metrics.annualisedVol * 100).toFixed(0)}% exceeds the ${(cfg.maxAnnualisedVol * 100).toFixed(0)}% ceiling`
    );
  }

  metrics.gapFrequency = gapFrequency(window, cfg.gapThreshold);
  if (metrics.gapFrequency > cfg.maxGapFrequency) {
    failures.push(
      `gaps beyond ${(cfg.gapThreshold * 100).toFixed(0)}% on ${(metrics.gapFrequency * 100).toFixed(1)}% of sessions, limit ${(cfg.maxGapFrequency * 100).toFixed(1)}% — stops cannot be relied on`
    );
  }

  metrics.maxDailyMove = maxDailyMove(window);
  if (metrics.maxDailyMove > cfg.maxSingleDayMove) {
    failures.push(
      `largest single-day move ${(metrics.maxDailyMove * 100).toFixed(0)}% exceeds the ${(cfg.maxSingleDayMove * 100).toFixed(0)}% limit`
    );
  }

  metrics.zeroVolumeSessions = zeroVolumeSessions(window);
  if (metrics.zeroVolumeSessions > cfg.maxZeroVolumeSessions) {
    failures.push(
      `${metrics.zeroVolumeSessions} sessions with no volume, limit ${cfg.maxZeroVolumeSessions}`
    );
  }

  metrics.medianDollarVolume = medianDollarVolume(window);
  if (metrics.medianDollarVolume < cfg.minMedianDollarVolume) {
    failures.push(
      `median daily value $${Math.round(metrics.medianDollarVolume).toLocaleString()} is below the $${cfg.minMedianDollarVolume.toLocaleString()} liquidity floor`
    );
  }

  metrics.longestFlatRun = longestFlatRun(window);
  if (metrics.longestFlatRun > cfg.maxFlatRun) {
    failures.push(
      `${metrics.longestFlatRun} consecutive identical closes, limit ${cfg.maxFlatRun} — price feed may be stale`
    );
  }

  // A composite score, reported for ranking transparency. It never overrides a
  // hard failure: a symbol that fails any check is out regardless of its score.
  const clamp = (v) => Math.max(0, Math.min(1, v));
  metrics.stabilityScore =
    0.35 * clamp(1 - (metrics.annualisedVol || 0) / cfg.maxAnnualisedVol) +
    0.25 * clamp(1 - metrics.gapFrequency / cfg.maxGapFrequency) +
    0.25 * clamp(Math.log10(1 + metrics.medianDollarVolume) / 9) +
    0.15 * clamp(bars.length / (cfg.minListingDays * 2));

  return { symbol, stable: failures.length === 0, metrics, failures };
}

module.exports = {
  screen,
  gapFrequency,
  maxDailyMove,
  zeroVolumeSessions,
  medianDollarVolume,
  longestFlatRun,
};
