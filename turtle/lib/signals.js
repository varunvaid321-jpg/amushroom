'use strict';

const ind = require('./indicators');

/**
 * Signal generation: Donchian breakout entries and exits, the Turtle whipsaw
 * filter, and the trend-quality gates.
 *
 * All decisions are made on the CLOSE of the most recent bar. Nothing here
 * looks at intraday data, and nothing looks ahead: every channel excludes the
 * bar being evaluated.
 */

/**
 * Compute the full indicator bundle once per symbol. The backtester and the
 * live path share this function so they cannot drift apart.
 */
function computeIndicators(bars, config) {
  const closes = bars.map((b) => b.c);
  const s1 = config.signals.system1;
  const s2 = config.signals.system2;
  const q = config.signals.quality;

  return {
    closes,
    atr: ind.atrWilder(bars, config.signals.atrPeriod),
    s1High: ind.donchianHigh(bars, s1.entryLookback),
    s1Low: ind.donchianLow(bars, s1.exitLookback),
    s2High: ind.donchianHigh(bars, s2.entryLookback),
    s2Low: ind.donchianLow(bars, s2.exitLookback),
    er: ind.efficiencyRatio(closes, q.efficiencyRatioPeriod),
    adx: ind.adx(bars, q.adxPeriod).adx,
    regression: ind.logPriceRegression(closes, q.regressionPeriod),
  };
}

/**
 * Trend-quality gates. All three must pass for a NEW entry.
 *
 * These deliberately do not apply to exits or stops: once you are in a trade you
 * exit on the rules, never on a quality score. Gating exits would leave you
 * holding a deteriorating position simply because it no longer looks tradeable.
 */
function evaluateQuality(indicators, i, config) {
  const q = config.signals.quality;
  const er = indicators.er[i];
  const adxValue = indicators.adx[i];
  const reg = indicators.regression[i];

  const checks = [
    {
      name: 'efficiencyRatio',
      value: er,
      threshold: q.minEfficiencyRatio,
      passed: er !== null && er >= q.minEfficiencyRatio,
    },
    {
      name: 'adx',
      value: adxValue,
      threshold: q.minAdx,
      passed: adxValue !== null && adxValue >= q.minAdx,
    },
    {
      name: 'rSquared',
      value: reg ? reg.r2 : null,
      threshold: q.minRSquared,
      passed: reg !== null && reg.r2 >= q.minRSquared,
    },
    {
      name: 'slope',
      value: reg ? reg.slope : null,
      threshold: 0,
      passed: reg !== null && reg.slope > 0,
    },
  ];

  const failed = checks.filter((c) => !c.passed);
  return {
    passed: failed.length === 0,
    checks,
    reasons: failed.map((c) => {
      const shown = c.value === null || c.value === undefined
        ? 'unavailable'
        : c.value.toFixed(4);
      return `${c.name} ${shown} < required ${c.threshold}`;
    }),
  };
}

/**
 * Entry evaluation at bar index `i`.
 *
 * System 2 (55-day) is checked first and is never filtered — the original Turtle
 * rules treat it as the always-on system precisely because skipping a System 2
 * breakout risks missing the one huge trend that pays for the year.
 *
 * System 1 (20-day) is checked only if System 2 did not fire, and is subject to
 * the whipsaw filter: if the previous System 1 breakout on this symbol was
 * profitable, this one is skipped.
 */
function evaluateEntry(bars, indicators, i, config, symbolState = {}) {
  const bar = bars[i];
  const n = indicators.atr[i];
  if (n === null || n <= 0) {
    return { triggered: false, reason: 'ATR unavailable' };
  }

  const s2Level = indicators.s2High[i];
  if (s2Level !== null && bar.c > s2Level) {
    return {
      triggered: true,
      system: 2,
      breakoutLevel: s2Level,
      close: bar.c,
      n,
      extensionN: (bar.c - s2Level) / n,
      exitLookback: config.signals.system2.exitLookback,
    };
  }

  const s1Level = indicators.s1High[i];
  if (s1Level !== null && bar.c > s1Level) {
    if (config.signals.system1.whipsawFilter && symbolState.lastSystem1Won === true) {
      return {
        triggered: false,
        system: 1,
        breakoutLevel: s1Level,
        reason: 'whipsaw filter: previous System 1 breakout was profitable',
      };
    }
    return {
      triggered: true,
      system: 1,
      breakoutLevel: s1Level,
      close: bar.c,
      n,
      extensionN: (bar.c - s1Level) / n,
      exitLookback: config.signals.system1.exitLookback,
    };
  }

  return { triggered: false, reason: 'no breakout' };
}

/**
 * Exit evaluation for an OPEN position at bar index `i`.
 *
 * The exit channel is fixed at entry by the system that opened the position — a
 * System 2 trade exits on the 20-day low even if a System 1 signal later appears.
 * Switching mid-trade would make the realised holding period incoherent with the
 * backtested distribution the forward estimates are drawn from.
 */
function evaluateExit(bars, indicators, i, position, config) {
  const bar = bars[i];
  const series = position.system === 1 ? indicators.s1Low : indicators.s2Low;
  const level = series[i];

  if (level !== null && bar.c < level) {
    return {
      triggered: true,
      kind: 'donchian',
      system: position.system,
      level,
      close: bar.c,
      reason: `close ${bar.c.toFixed(2)} below ${
        position.system === 1
          ? config.signals.system1.exitLookback
          : config.signals.system2.exitLookback
      }-day low ${level.toFixed(2)}`,
    };
  }

  return { triggered: false, level };
}

/**
 * Did the hard stop get taken out intraday? Checked against the bar LOW, not the
 * close, because the stop rests at the broker and fills the moment it trades.
 *
 * A gap through the stop fills at the open, not the stop price — modelling that
 * honestly is what keeps backtested drawdowns from being optimistic.
 */
function evaluateStopHit(bar, stopPrice) {
  if (stopPrice === null || stopPrice === undefined) return { triggered: false };
  if (bar.l > stopPrice) return { triggered: false };

  const gapped = bar.o < stopPrice;
  return {
    triggered: true,
    kind: 'stop',
    fillPrice: gapped ? bar.o : stopPrice,
    gapped,
    reason: gapped
      ? `gapped through stop ${stopPrice.toFixed(2)}, filled at open ${bar.o.toFixed(2)}`
      : `stop ${stopPrice.toFixed(2)} hit intraday`,
  };
}

module.exports = {
  computeIndicators,
  evaluateQuality,
  evaluateEntry,
  evaluateExit,
  evaluateStopHit,
};
