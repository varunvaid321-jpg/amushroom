'use strict';

const ind = require('./indicators');

/**
 * Cross-sectional ranking.
 *
 * On a $10k book, capital — not signal count — is the binding constraint. When
 * five breakouts fire and there is room for one, the choice of WHICH one is a
 * real source of return, and leaving it to whichever ticker sorts first
 * alphabetically throws that away.
 *
 * Scores are z-scored within the candidate set for the day, so the ranking is
 * always relative to the actual opportunity set rather than to a fixed threshold
 * that drifts out of calibration as market conditions change.
 */

/**
 * Build the raw metric vector for one candidate.
 *
 * `breakoutTightness` is negated extension: a close that has run 2.5N past its
 * breakout level is a worse entry than one sitting 0.2N past it, because the
 * stop is anchored to the fill and the extended entry is simply paying more for
 * the same 2N of risk.
 */
function candidateMetrics(candidate, config) {
  const { indicators, index, snapshot } = candidate;
  const reg = indicators.regression[index];

  return {
    momentum: ind.momentum12_1(
      indicators.closes.slice(0, index + 1),
      config.ranking.momentumLookback,
      config.ranking.momentumSkip
    ),
    efficiencyRatio: indicators.er[index],
    breakoutTightness: candidate.entry ? -candidate.entry.extensionN : null,
    adx: indicators.adx[index],
    liquidity: snapshot && snapshot.avgDailyValue > 0
      ? Math.log(snapshot.avgDailyValue)
      : null,
    rSquared: reg ? reg.r2 : null,
  };
}

/**
 * Score and sort candidates, best first.
 *
 * Returns every candidate with a full metric and contribution breakdown so the
 * daily brief can explain a ranking rather than assert one.
 */
function rankCandidates(candidates, config) {
  if (candidates.length === 0) return [];

  const weights = config.ranking.weights;
  const keys = Object.keys(weights);
  const metrics = candidates.map((c) => candidateMetrics(c, config));

  // Z-score each metric across the candidate set.
  const zByKey = {};
  for (const key of keys) {
    zByKey[key] = ind.zScores(metrics.map((m) => m[key]));
  }

  const scored = candidates.map((candidate, i) => {
    const contributions = {};
    let score = 0;
    for (const key of keys) {
      const contribution = weights[key] * zByKey[key][i];
      contributions[key] = {
        raw: metrics[i][key],
        z: zByKey[key][i],
        weight: weights[key],
        contribution,
      };
      score += contribution;
    }
    return { ...candidate, metrics: metrics[i], contributions, score };
  });

  // Ties are broken by efficiency ratio: given equal scores, prefer the cleaner
  // trend, which is the metric most predictive of a trade that survives to a pyramid.
  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.metrics.efficiencyRatio ?? 0) - (a.metrics.efficiencyRatio ?? 0);
  });
}

module.exports = { candidateMetrics, rankCandidates };
