'use strict';

/**
 * Technical indicators for the Turtle engine.
 *
 * Every function is pure and dependency-free. Series functions return an array
 * aligned index-for-index with the input bars; positions that cannot be computed
 * (warm-up period) are `null` rather than 0, so a caller can never mistake an
 * unwarmed value for a real one.
 *
 * A "bar" is `{ t, o, h, l, c, v }` — t is an ISO timestamp string.
 */

/** Sum of an array segment [from, to). */
function sumRange(values, from, to) {
  let total = 0;
  for (let i = from; i < to; i += 1) total += values[i];
  return total;
}

/**
 * True Range. TR[0] is high-low since there is no prior close to gap from.
 * TR_i = max(H-L, |H - C_prev|, |L - C_prev|)
 */
function trueRange(bars) {
  const out = new Array(bars.length);
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    if (i === 0) {
      out[i] = bar.h - bar.l;
      continue;
    }
    const prevClose = bars[i - 1].c;
    out[i] = Math.max(
      bar.h - bar.l,
      Math.abs(bar.h - prevClose),
      Math.abs(bar.l - prevClose)
    );
  }
  return out;
}

/**
 * Wilder's ATR — this is the Turtles' "N".
 * Seeded with a simple mean of the first `period` true ranges, then smoothed
 * as N_i = ((period-1) * N_{i-1} + TR_i) / period.
 */
function atrWilder(bars, period) {
  const out = new Array(bars.length).fill(null);
  if (bars.length < period) return out;

  const tr = trueRange(bars);
  let atr = sumRange(tr, 0, period) / period;
  out[period - 1] = atr;

  for (let i = period; i < bars.length; i += 1) {
    atr = ((period - 1) * atr + tr[i]) / period;
    out[i] = atr;
  }
  return out;
}

/**
 * Donchian upper channel: the highest high of the `period` bars ENDING at i-1.
 * The current bar is deliberately excluded — a breakout must exceed the prior
 * range, not the range it is itself setting.
 */
function donchianHigh(bars, period) {
  const out = new Array(bars.length).fill(null);
  for (let i = period; i < bars.length; i += 1) {
    let highest = -Infinity;
    for (let j = i - period; j < i; j += 1) {
      if (bars[j].h > highest) highest = bars[j].h;
    }
    out[i] = highest;
  }
  return out;
}

/** Donchian lower channel: lowest low of the `period` bars ending at i-1. */
function donchianLow(bars, period) {
  const out = new Array(bars.length).fill(null);
  for (let i = period; i < bars.length; i += 1) {
    let lowest = Infinity;
    for (let j = i - period; j < i; j += 1) {
      if (bars[j].l < lowest) lowest = bars[j].l;
    }
    out[i] = lowest;
  }
  return out;
}

/** Simple moving average over a plain numeric series. */
function sma(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;

  let running = sumRange(values, 0, period);
  out[period - 1] = running / period;

  for (let i = period; i < values.length; i += 1) {
    running += values[i] - values[i - period];
    out[i] = running / period;
  }
  return out;
}

/**
 * Wilder's ADX — trend-strength confirmation.
 * Returns { plusDi, minusDi, adx } as aligned series.
 *
 * Directional movement is only counted when it dominates the opposite side:
 * an inside day contributes nothing to either direction.
 */
function adx(bars, period) {
  const n = bars.length;
  const plusDi = new Array(n).fill(null);
  const minusDi = new Array(n).fill(null);
  const adxOut = new Array(n).fill(null);
  if (n < period * 2) return { plusDi, minusDi, adx: adxOut };

  const tr = trueRange(bars);
  const plusDm = new Array(n).fill(0);
  const minusDm = new Array(n).fill(0);

  for (let i = 1; i < n; i += 1) {
    const upMove = bars[i].h - bars[i - 1].h;
    const downMove = bars[i - 1].l - bars[i].l;
    if (upMove > downMove && upMove > 0) plusDm[i] = upMove;
    if (downMove > upMove && downMove > 0) minusDm[i] = downMove;
  }

  // Wilder seeds the smoothed series with a raw sum over bars 1..period.
  let smoothTr = sumRange(tr, 1, period + 1);
  let smoothPlus = sumRange(plusDm, 1, period + 1);
  let smoothMinus = sumRange(minusDm, 1, period + 1);

  const dx = new Array(n).fill(null);

  const writeDi = (i) => {
    if (smoothTr === 0) {
      plusDi[i] = 0;
      minusDi[i] = 0;
      dx[i] = 0;
      return;
    }
    const pdi = (100 * smoothPlus) / smoothTr;
    const mdi = (100 * smoothMinus) / smoothTr;
    plusDi[i] = pdi;
    minusDi[i] = mdi;
    const diSum = pdi + mdi;
    dx[i] = diSum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / diSum;
  };

  writeDi(period);

  for (let i = period + 1; i < n; i += 1) {
    smoothTr = smoothTr - smoothTr / period + tr[i];
    smoothPlus = smoothPlus - smoothPlus / period + plusDm[i];
    smoothMinus = smoothMinus - smoothMinus / period + minusDm[i];
    writeDi(i);
  }

  // ADX is itself a Wilder average of DX, seeded once `period` DX values exist.
  const firstAdxIdx = period * 2 - 1;
  if (firstAdxIdx >= n) return { plusDi, minusDi, adx: adxOut };

  let running = 0;
  for (let i = period; i <= firstAdxIdx; i += 1) running += dx[i];
  let current = running / period;
  adxOut[firstAdxIdx] = current;

  for (let i = firstAdxIdx + 1; i < n; i += 1) {
    current = ((period - 1) * current + dx[i]) / period;
    adxOut[i] = current;
  }

  return { plusDi, minusDi, adx: adxOut };
}

/**
 * Kaufman Efficiency Ratio — net directional travel divided by total path length.
 * 1.0 is a straight line, 0.0 is pure noise. This is the primary "clean trend" gate.
 */
function efficiencyRatio(closes, period) {
  const out = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i += 1) {
    const netMove = Math.abs(closes[i] - closes[i - period]);
    let pathLength = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      pathLength += Math.abs(closes[j] - closes[j - 1]);
    }
    out[i] = pathLength === 0 ? 0 : netMove / pathLength;
  }
  return out;
}

/**
 * Rolling OLS of log(price) against bar index.
 * Returns aligned series of { slope, r2 } — slope is per-bar log return drift.
 * A high R-squared means the uptrend is persistent rather than one violent gap.
 */
function logPriceRegression(closes, period) {
  const out = new Array(closes.length).fill(null);
  if (period < 2) return out;

  // Index terms are constant for a fixed window, so compute them once.
  const sumX = (period * (period - 1)) / 2;
  const sumXX = ((period - 1) * period * (2 * period - 1)) / 6;
  const denomX = period * sumXX - sumX * sumX;

  for (let i = period - 1; i < closes.length; i += 1) {
    let sumY = 0;
    let sumXY = 0;
    let sumYY = 0;
    let valid = true;

    for (let k = 0; k < period; k += 1) {
      const price = closes[i - period + 1 + k];
      if (!(price > 0)) {
        valid = false;
        break;
      }
      const y = Math.log(price);
      sumY += y;
      sumXY += k * y;
      sumYY += y * y;
    }
    if (!valid) continue;

    const slope = (period * sumXY - sumX * sumY) / denomX;
    const denomY = period * sumYY - sumY * sumY;
    // Zero variance in y means a flat line: no trend, so R-squared is 0 by convention.
    const r2 = denomY <= 0
      ? 0
      : Math.pow(period * sumXY - sumX * sumY, 2) / (denomX * denomY);

    out[i] = { slope, r2 };
  }
  return out;
}

/** Simple period-over-period returns. First element is null. */
function simpleReturns(values) {
  const out = new Array(values.length).fill(null);
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    out[i] = prev === 0 ? null : values[i] / prev - 1;
  }
  return out;
}

/** Pearson correlation of two equal-length numeric arrays. Returns null if undefined. */
function correlation(a, b) {
  if (a.length !== b.length || a.length < 2) return null;

  const pairs = [];
  for (let i = 0; i < a.length; i += 1) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) pairs.push([a[i], b[i]]);
  }
  if (pairs.length < 2) return null;

  const n = pairs.length;
  let meanA = 0;
  let meanB = 0;
  for (const [x, y] of pairs) {
    meanA += x;
    meanB += y;
  }
  meanA /= n;
  meanB /= n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanA;
    const dy = y - meanB;
    cov += dx * dy;
    varA += dx * dx;
    varB += dy * dy;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

/**
 * Annualised realised volatility from the last `period` daily returns.
 * 252 trading days per year.
 */
function realizedVolatility(closes, period) {
  const out = new Array(closes.length).fill(null);
  const rets = simpleReturns(closes);

  for (let i = period; i < closes.length; i += 1) {
    let mean = 0;
    for (let j = i - period + 1; j <= i; j += 1) mean += rets[j];
    mean /= period;

    let variance = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      variance += Math.pow(rets[j] - mean, 2);
    }
    variance /= period - 1;
    out[i] = Math.sqrt(variance) * Math.sqrt(252);
  }
  return out;
}

/** Linear-interpolated percentile of a numeric sample. `p` is a fraction (0.9 = 90th). */
function percentile(values, p) {
  const clean = values.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (clean.length === 0) return null;
  if (clean.length === 1) return clean[0];

  const rank = p * (clean.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return clean[lower];
  return clean[lower] + (rank - lower) * (clean[upper] - clean[lower]);
}

/**
 * Cross-sectional z-scores. Values that are not finite map to 0 (neutral) so a
 * single missing metric cannot knock a candidate out of the ranking entirely.
 */
function zScores(values) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return values.map(() => 0);

  const mean = finite.reduce((acc, v) => acc + v, 0) / finite.length;
  if (finite.length < 2) return values.map((v) => (Number.isFinite(v) ? 0 : 0));

  const variance =
    finite.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (finite.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return values.map(() => 0);

  return values.map((v) => (Number.isFinite(v) ? (v - mean) / sd : 0));
}

/**
 * 12-1 momentum: total return from t-lookback to t-skip.
 * Skipping the most recent month avoids the well-documented short-term reversal
 * effect that contaminates raw 12-month momentum.
 */
function momentum12_1(closes, lookback, skip) {
  const i = closes.length - 1;
  const startIdx = i - lookback;
  const endIdx = i - skip;
  if (startIdx < 0 || endIdx < 0 || closes[startIdx] <= 0) return null;
  return closes[endIdx] / closes[startIdx] - 1;
}

module.exports = {
  trueRange,
  atrWilder,
  donchianHigh,
  donchianLow,
  sma,
  adx,
  efficiencyRatio,
  logPriceRegression,
  simpleReturns,
  correlation,
  realizedVolatility,
  percentile,
  zScores,
  momentum12_1,
};
