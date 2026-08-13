'use strict';

/**
 * Data integrity verification — the gate every price must pass before it is
 * allowed to influence a recommendation.
 *
 * The governing rule is FAIL-CLOSED: when sources disagree beyond tolerance, or
 * a bar is structurally impossible, or the session has not settled, the symbol
 * is dropped from the run with a printed reason. Abstaining costs one missed
 * trade. Acting on a bad price costs real money and destroys trust in every
 * other number the system prints.
 *
 * Nothing here ever repairs, interpolates, or infers a price.
 */

const VERDICT = {
  VERIFIED: 'VERIFIED',
  WARN: 'WARN',
  ABSTAIN: 'ABSTAIN',
};

/** Relative difference in basis points. */
function diffBps(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return 0;
  return (Math.abs(a - b) / scale) * 10000;
}

/**
 * Convert an IBKR `get_price_history` response into bars.
 *
 * The response holds parallel arrays. A length mismatch between them means the
 * payload is malformed — that is a hard error, not something to zip together
 * and hope for the best.
 */
function parseIbkrHistory(response) {
  const { time, open, high, low, close, volume } = response || {};
  if (!Array.isArray(time)) {
    throw new Error('IBKR history response has no time array');
  }
  const arrays = { open, high, low, close, volume };
  for (const [name, arr] of Object.entries(arrays)) {
    if (!Array.isArray(arr) || arr.length !== time.length) {
      throw new Error(
        `IBKR history response malformed: ${name} length ${arr ? arr.length : 'missing'} does not match time length ${time.length}`
      );
    }
  }
  return time.map((t, i) => ({
    t,
    o: open[i],
    h: high[i],
    l: low[i],
    c: close[i],
    v: volume[i],
  }));
}

/** Wall-clock parts in the exchange timezone, without pulling in a date library. */
function exchangeParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  // en-CA renders midnight as hour 24; normalise it so comparisons behave.
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(hour),
    minute: Number(parts.minute),
    minutesOfDay: Number(hour) * 60 + Number(parts.minute),
  };
}

/**
 * Has the session that produced the last bar actually settled?
 *
 * IBKR returns the CURRENT day's bar while the market is still open, and that
 * bar keeps changing. Treating it as final is the single most likely way to
 * generate a phantom breakout, so this gate runs before anything else.
 */
function checkSessionClosed(bars, now, config) {
  const cfg = config.integrity;
  const tz = cfg.exchangeTimezone;
  if (bars.length === 0) {
    return { passed: false, reason: 'no bars returned' };
  }

  const lastBar = bars[bars.length - 1];
  const barDate = exchangeParts(new Date(lastBar.t), tz).date;
  const nowParts = exchangeParts(now, tz);

  const [closeHour, closeMinute] = cfg.sessionCloseEt.split(':').map(Number);
  const settleAt = closeHour * 60 + closeMinute + cfg.settleBufferMinutes;

  if (barDate > nowParts.date) {
    return {
      passed: false,
      reason: `last bar is dated ${barDate}, which is ahead of the exchange date ${nowParts.date}`,
      barDate,
    };
  }

  if (barDate === nowParts.date && nowParts.minutesOfDay < settleAt) {
    return {
      passed: false,
      reason: `last bar ${barDate} is still forming — exchange time is ${String(nowParts.hour).padStart(2, '0')}:${String(nowParts.minute).padStart(2, '0')}, settlement is ${cfg.sessionCloseEt} plus ${cfg.settleBufferMinutes}min`,
      barDate,
      partial: true,
    };
  }

  return { passed: true, barDate, reason: null };
}

/**
 * Structural invariants. A bar that violates one of these is not a price that
 * happens to be wrong — it is not a price at all.
 */
function checkInvariants(bars, config) {
  const violations = [];
  const seen = new Set();

  bars.forEach((bar, i) => {
    const where = `bar ${i} (${bar.t})`;

    for (const [field, value] of Object.entries({ o: bar.o, h: bar.h, l: bar.l, c: bar.c })) {
      if (!Number.isFinite(value)) {
        violations.push(`${where}: ${field} is not a finite number (${value})`);
      }
    }
    if (violations.length && !Number.isFinite(bar.h)) return;

    if (bar.h < bar.l) violations.push(`${where}: high ${bar.h} is below low ${bar.l}`);
    if (bar.h < Math.max(bar.o, bar.c)) {
      violations.push(`${where}: high ${bar.h} is below open/close ${Math.max(bar.o, bar.c)}`);
    }
    if (bar.l > Math.min(bar.o, bar.c)) {
      violations.push(`${where}: low ${bar.l} is above open/close ${Math.min(bar.o, bar.c)}`);
    }
    if (bar.h <= 0 || bar.l <= 0) violations.push(`${where}: non-positive price`);
    if (!(bar.v > 0)) violations.push(`${where}: volume is ${bar.v}`);

    if (seen.has(bar.t)) violations.push(`${where}: duplicate timestamp`);
    seen.add(bar.t);

    if (i > 0 && new Date(bar.t) <= new Date(bars[i - 1].t)) {
      violations.push(`${where}: timestamp is not strictly after the previous bar`);
    }
  });

  // A move this large is usually a split or consolidation that the feed has not
  // adjusted. It is flagged, never silently accepted, because an unadjusted
  // split manufactures a spectacular fake breakout.
  const suspectMoves = [];
  for (let i = 1; i < bars.length; i += 1) {
    const prev = bars[i - 1].c;
    if (!(prev > 0)) continue;
    const move = bars[i].c / prev - 1;
    if (Math.abs(move) > config.integrity.maxDailyReturnPct) {
      suspectMoves.push(
        `bar ${i} (${bars[i].t}): ${(move * 100).toFixed(1)}% move — verify no unadjusted corporate action`
      );
    }
  }

  return { passed: violations.length === 0, violations, suspectMoves };
}

/** Group intraday bars into daily OHLCV by exchange-local date. */
function aggregateToDaily(intradayBars, timeZone) {
  const byDate = new Map();
  for (const bar of intradayBars) {
    const date = exchangeParts(new Date(bar.t), timeZone).date;
    const existing = byDate.get(date);
    if (!existing) {
      byDate.set(date, { date, o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v });
      continue;
    }
    existing.h = Math.max(existing.h, bar.h);
    existing.l = Math.min(existing.l, bar.l);
    existing.c = bar.c; // bars arrive in order, so the last one closes the day
    existing.v += bar.v;
  }
  return [...byDate.values()];
}

/**
 * Compare two independent bar series on their overlapping dates.
 *
 * On ANY disagreement, however small, the CONSERVATIVE value is adopted: the
 * higher high (a breakout must clear the harder level), the lower low and lower
 * open (a stop is assumed to have filled at the worse price), and the lower
 * close (less likely to trigger an entry). Every choice biases toward not
 * trading and toward assuming the position was stopped.
 *
 * Adoption is deliberately NOT gated on the tolerance bands. Observed SMART vs
 * native-exchange disagreement on a real TSX name ran ~12bps — under the 15bps
 * band, yet easily enough to flip a Donchian breakout when the close lands
 * between the two values. The bands decide how loudly to report a difference,
 * never whether to take the safer number.
 */
function reconcile(primary, secondary, config, label) {
  const cfg = config.integrity;
  const byDate = new Map();
  for (const bar of secondary) {
    byDate.set(exchangeParts(new Date(bar.t), cfg.exchangeTimezone).date, bar);
  }

  const discrepancies = [];
  let compared = 0;
  let worstBps = 0;
  let adopted = 0;

  const resolved = primary.map((bar) => {
    const date = exchangeParts(new Date(bar.t), cfg.exchangeTimezone).date;
    const other = byDate.get(date);
    if (!other) return bar;

    compared += 1;
    const merged = { ...bar };

    const fields = [
      { key: 'c', tolerance: cfg.closeToleranceBps, pick: Math.min },
      { key: 'h', tolerance: cfg.highLowToleranceBps, pick: Math.max },
      { key: 'l', tolerance: cfg.highLowToleranceBps, pick: Math.min },
      { key: 'o', tolerance: cfg.highLowToleranceBps, pick: Math.min },
    ];

    for (const { key, tolerance, pick } of fields) {
      const bps = diffBps(bar[key], other[key]);
      if (bps > worstBps) worstBps = bps;
      if (bps === 0) continue;

      // Take the safer number first, then decide how loudly to report it.
      const conservative = pick(bar[key], other[key]);
      if (conservative !== bar[key]) adopted += 1;
      merged[key] = conservative;

      if (bps <= tolerance) continue;

      discrepancies.push({
        date,
        field: key,
        primary: bar[key],
        secondary: other[key],
        bps,
        adopted: conservative,
        fatal: bps > cfg.abstainToleranceBps,
        source: label,
      });
    }
    return merged;
  });

  const fatal = discrepancies.filter((d) => d.fatal);
  return {
    label,
    compared,
    worstBps,
    adopted,
    discrepancies,
    fatal,
    passed: fatal.length === 0,
    bars: resolved,
  };
}

/**
 * Cross-check computed levels against the independent statistics the snapshot
 * endpoint reports. This catches an entire history series being wrong in a
 * consistent way, which bar-to-bar reconciliation cannot see.
 *
 * Calendar windows and session windows never line up exactly, so the tolerance
 * here is deliberately loose — this check is looking for gross error, not drift.
 */
function checkSnapshotEnvelope(bars, snapshot, config) {
  const findings = [];
  if (!snapshot || !snapshot['misc-statistics']) {
    return { passed: true, skipped: true, findings: ['snapshot statistics unavailable'] };
  }

  const stats = snapshot['misc-statistics'];
  const window = bars.slice(-252);
  const barsHigh = Math.max(...window.map((b) => b.h));
  const barsLow = Math.min(...window.map((b) => b.l));

  if (Number.isFinite(stats.high_52w) && barsHigh > stats.high_52w * 1.02) {
    findings.push(
      `computed 52-week high ${barsHigh.toFixed(2)} exceeds the reported ${stats.high_52w.toFixed(2)} by more than 2%`
    );
  }
  if (Number.isFinite(stats.low_52w) && barsLow < stats.low_52w * 0.98) {
    findings.push(
      `computed 52-week low ${barsLow.toFixed(2)} is more than 2% below the reported ${stats.low_52w.toFixed(2)}`
    );
  }

  // ATR-implied annualised volatility against the feed's own figure. An order-of
  // -magnitude gap means one of the two is measuring a different instrument.
  const hv = snapshot['historical-vol'];
  if (hv && Number.isFinite(hv.annual_pct) && hv.annual_pct > 0) {
    const last = bars[bars.length - 1];
    const ranges = bars.slice(-20).map((b) => b.h - b.l);
    const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
    const impliedAnnual = (avgRange / last.c) * Math.sqrt(252);
    const ratio = impliedAnnual / hv.annual_pct;
    if (ratio > 3 || ratio < 1 / 3) {
      findings.push(
        `ATR-implied volatility ${(impliedAnnual * 100).toFixed(0)}% diverges from reported ${(hv.annual_pct * 100).toFixed(0)}% by more than 3x`
      );
    }
  }

  return { passed: findings.length === 0, skipped: false, findings };
}

/**
 * Run the full ladder for one symbol.
 *
 * `sources.primary` is required. Every other source is optional: a missing
 * cross-check downgrades confidence and is reported, but does not by itself
 * abstain — the alternative would be a system that refuses to trade whenever
 * one optional endpoint is slow.
 */
function verifySymbol({ symbol, sources, now, config }) {
  const checks = [];
  let verdict = VERDICT.VERIFIED;
  const fail = (name, detail) => {
    checks.push({ name, passed: false, detail });
    verdict = VERDICT.ABSTAIN;
  };
  const warn = (name, detail) => {
    checks.push({ name, passed: true, warning: true, detail });
    if (verdict === VERDICT.VERIFIED) verdict = VERDICT.WARN;
  };
  const pass = (name, detail) => checks.push({ name, passed: true, detail });

  let bars;
  try {
    bars = parseIbkrHistory(sources.primary);
  } catch (error) {
    return {
      symbol,
      verdict: VERDICT.ABSTAIN,
      bars: null,
      checks: [{ name: 'parse', passed: false, detail: error.message }],
      sourcesAgreed: 0,
    };
  }

  const session = checkSessionClosed(bars, now, config);
  if (!session.passed) fail('session-closed', session.reason);
  else pass('session-closed', `last settled session ${session.barDate}`);

  const invariants = checkInvariants(bars, config);
  if (!invariants.passed) fail('invariants', invariants.violations.slice(0, 5).join('; '));
  else pass('invariants', `${bars.length} bars structurally valid`);
  if (invariants.suspectMoves.length > 0) {
    warn('corporate-actions', invariants.suspectMoves.join('; '));
  }

  if (bars.length < config.integrity.minBarsRequired) {
    fail(
      'history-depth',
      `${bars.length} bars available, ${config.integrity.minBarsRequired} required`
    );
  } else {
    pass('history-depth', `${bars.length} bars`);
  }

  let sourcesAgreed = 1;

  if (sources.secondary) {
    try {
      const rec = reconcile(bars, parseIbkrHistory(sources.secondary), config, 'native-exchange');
      bars = rec.bars;
      if (!rec.passed) {
        fail(
          'reconcile-exchange',
          rec.fatal
            .map(
              (d) =>
                `${d.date} ${d.field}: ${d.primary.toFixed(4)} vs ${d.secondary.toFixed(4)} (${d.bps.toFixed(1)}bps)`
            )
            .join('; ')
        );
      } else if (rec.discrepancies.length > 0) {
        sourcesAgreed += 1;
        warn(
          'reconcile-exchange',
          `${rec.discrepancies.length} field(s) differed within tolerance, conservative value adopted (worst ${rec.worstBps.toFixed(1)}bps)`
        );
      } else {
        sourcesAgreed += 1;
        pass(
          'reconcile-exchange',
          rec.adopted > 0
            ? `${rec.compared} sessions compared, ${rec.adopted} sub-tolerance field(s) resolved to the conservative value (worst ${rec.worstBps.toFixed(1)}bps)`
            : `${rec.compared} sessions matched exactly`
        );
      }
    } catch (error) {
      warn('reconcile-exchange', `secondary source unusable: ${error.message}`);
    }
  } else {
    warn('reconcile-exchange', 'no native-exchange series supplied');
  }

  if (sources.hourly) {
    try {
      const hourly = parseIbkrHistory(sources.hourly);
      const daily = aggregateToDaily(hourly, config.integrity.exchangeTimezone);
      // Only the sessions the hourly window fully covers are comparable.
      const asBars = daily.map((d) => ({ ...d, t: `${d.date}T00:00:00Z` }));
      const rec = reconcile(bars.slice(-asBars.length), asBars, config, 'hourly-aggregate');
      if (!rec.passed) {
        fail(
          'cross-timeframe',
          rec.fatal
            .map((d) => `${d.date} ${d.field}: daily ${d.primary} vs hourly-aggregate ${d.secondary}`)
            .join('; ')
        );
      } else {
        sourcesAgreed += 1;
        pass('cross-timeframe', `${rec.compared} sessions reconciled against hourly bars`);
      }
    } catch (error) {
      warn('cross-timeframe', `hourly source unusable: ${error.message}`);
    }
  } else {
    warn('cross-timeframe', 'no hourly series supplied');
  }

  const envelope = checkSnapshotEnvelope(bars, sources.snapshot, config);
  if (envelope.skipped) {
    warn('snapshot-envelope', envelope.findings[0]);
  } else if (!envelope.passed) {
    fail('snapshot-envelope', envelope.findings.join('; '));
  } else {
    sourcesAgreed += 1;
    pass('snapshot-envelope', 'computed levels sit inside the reported 52-week range');
  }

  return {
    symbol,
    verdict,
    bars: verdict === VERDICT.ABSTAIN ? null : bars,
    checks,
    sourcesAgreed,
    tradeable: verdict !== VERDICT.ABSTAIN,
  };
}

module.exports = {
  VERDICT,
  diffBps,
  parseIbkrHistory,
  exchangeParts,
  checkSessionClosed,
  checkInvariants,
  aggregateToDaily,
  reconcile,
  checkSnapshotEnvelope,
  verifySymbol,
};
