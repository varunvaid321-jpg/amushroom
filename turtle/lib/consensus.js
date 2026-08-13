'use strict';

const { diffBps, exchangeParts, checkInvariants, checkSessionClosed, VERDICT } = require('./integrity');

/**
 * N-source consensus.
 *
 * Two sources can only tell you THAT they disagree. Three or more can tell you
 * WHICH one is wrong — and that difference is what lets this system stay up when
 * a provider goes bad instead of refusing to trade.
 *
 * With three sources, a single provider that has drifted, mis-mapped a ticker,
 * or is serving a stale split-unadjusted series is outvoted and dropped for the
 * affected bars. Its failure costs one source, not the run. With two sources a
 * material disagreement is unresolvable and the symbol abstains, because there
 * is no way to know which is right and guessing is the one thing never allowed.
 *
 * Among surviving sources the conservative value is taken on every field:
 * the higher high (a breakout must clear the harder level), the lower low, the
 * lower open, the lower close (less likely to trigger an entry, more likely to
 * trigger an exit), and the lower volume (harder to clear the liquidity screen).
 */

const FIELDS = [
  { key: 'h', pick: 'max' },
  { key: 'l', pick: 'min' },
  { key: 'o', pick: 'min' },
  { key: 'c', pick: 'min' },
  { key: 'v', pick: 'min' },
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Index each source's bars by exchange-local date. */
function indexSources(sources, timeZone) {
  return sources.map((source) => {
    const byDate = new Map();
    for (const bar of source.bars) {
      byDate.set(exchangeParts(new Date(bar.t), timeZone).date, bar);
    }
    return { provider: source.provider, byDate };
  });
}

/**
 * Reconcile one field across the sources that carry it.
 *
 * Outlier rejection runs only with three or more values: with two there is no
 * majority to appeal to, so a wide gap is reported as fatal rather than resolved
 * by picking a side.
 */
function reconcileField(key, pick, entries, config) {
  const cfg = config.integrity;
  const tolerance = key === 'c' ? cfg.closeToleranceBps : cfg.highLowToleranceBps;

  let inliers = entries;
  const outliers = [];

  if (entries.length >= 3) {
    const reference = median(entries.map((e) => e.value));
    inliers = [];
    for (const entry of entries) {
      if (diffBps(entry.value, reference) > cfg.abstainToleranceBps) outliers.push(entry);
      else inliers.push(entry);
    }
    // Everything far from its own median means the sources are mutually
    // incoherent; there is no majority to trust.
    if (inliers.length === 0) inliers = entries;
  }

  let worstBps = 0;
  for (let i = 0; i < inliers.length; i += 1) {
    for (let j = i + 1; j < inliers.length; j += 1) {
      worstBps = Math.max(worstBps, diffBps(inliers[i].value, inliers[j].value));
    }
  }

  const values = inliers.map((e) => e.value);
  const value = pick === 'max' ? Math.max(...values) : Math.min(...values);

  return {
    value,
    worstBps,
    outliers,
    // Only an unresolved spread among the SURVIVING sources is fatal. A rejected
    // outlier has already been handled and must not also veto the bar.
    fatal: worstBps > cfg.abstainToleranceBps,
    warn: worstBps > tolerance && worstBps <= cfg.abstainToleranceBps,
  };
}

/**
 * Build consensus bars from N sources.
 *
 * History may be thin — a date only one provider carries is still usable for
 * indicator warm-up. The DECISION bar is held to a stricter standard: it must
 * carry the configured quorum, because that is the bar every recommendation
 * depends on.
 */
function buildConsensus({ symbol, sources, config, now }) {
  const cfg = config.integrity;
  const minSources = (config.providers && config.providers.minSourcesForTrade) || 2;
  const checks = [];
  const disagreements = [];
  const rejectedOutliers = [];

  if (sources.length === 0) {
    return {
      symbol,
      verdict: VERDICT.ABSTAIN,
      bars: null,
      quorum: 0,
      sourcesUsed: [],
      checks: [{ name: 'sources', passed: false, detail: 'no provider returned data' }],
      disagreements,
    };
  }

  const indexed = indexSources(sources, cfg.exchangeTimezone);
  const allDates = new Set();
  for (const source of indexed) for (const date of source.byDate.keys()) allDates.add(date);
  const dates = [...allDates].sort();

  const bars = [];
  let fatalDetail = null;

  for (const date of dates) {
    const present = indexed.filter((s) => s.byDate.has(date));
    const bar = { t: `${date}T14:30:00.000Z` };
    let barFatal = null;

    for (const { key, pick } of FIELDS) {
      const entries = present
        .map((s) => ({ provider: s.provider, value: s.byDate.get(date)[key] }))
        .filter((e) => Number.isFinite(e.value));
      if (entries.length === 0) {
        barFatal = `${date}: no source carries field ${key}`;
        break;
      }

      const field = reconcileField(key, pick, entries, config);
      bar[key] = field.value;

      for (const outlier of field.outliers) {
        rejectedOutliers.push({ date, field: key, provider: outlier.provider, value: outlier.value });
      }
      if (field.warn || field.fatal) {
        disagreements.push({
          date,
          field: key,
          bps: field.worstBps,
          fatal: field.fatal,
          providers: entries.map((e) => e.provider),
        });
      }
      if (field.fatal) {
        barFatal = `${date} ${key}: sources disagree by ${field.worstBps.toFixed(1)}bps with no majority to resolve it`;
      }
    }

    if (barFatal) {
      // A fatal disagreement on the newest bar is decisive; deep in history it
      // only costs that one bar.
      if (date === dates[dates.length - 1]) {
        fatalDetail = barFatal;
        break;
      }
      continue;
    }
    bar.sourceCount = present.length;
    bars.push(bar);
  }

  if (fatalDetail) {
    return {
      symbol,
      verdict: VERDICT.ABSTAIN,
      bars: null,
      quorum: 0,
      sourcesUsed: sources.map((s) => s.provider),
      checks: [{ name: 'consensus', passed: false, detail: fatalDetail }],
      disagreements,
      rejectedOutliers,
    };
  }

  const decisionBar = bars[bars.length - 1];
  const quorum = decisionBar ? decisionBar.sourceCount : 0;

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

  if (bars.length === 0) {
    fail('consensus', 'no bar survived reconciliation');
    return { symbol, verdict, bars: null, quorum: 0, sourcesUsed: [], checks, disagreements };
  }

  if (quorum >= minSources) {
    pass('quorum', `${quorum} independent sources agree on the decision bar`);
  } else {
    // One source is not verification. The run continues and the symbol is
    // reported, but it is not tradeable.
    fail(
      'quorum',
      `only ${quorum} source(s) carry the decision bar, ${minSources} required to trade`
    );
  }

  const session = checkSessionClosed(bars, now, config);
  if (!session.passed) fail('session-closed', session.reason);
  else pass('session-closed', `last settled session ${session.barDate}`);

  const invariants = checkInvariants(bars, config);
  if (!invariants.passed) fail('invariants', invariants.violations.slice(0, 5).join('; '));
  else pass('invariants', `${bars.length} bars structurally valid`);
  if (invariants.suspectMoves.length > 0) {
    warn('corporate-actions', invariants.suspectMoves.slice(0, 3).join('; '));
  }

  if (bars.length < cfg.minBarsRequired) {
    fail('history-depth', `${bars.length} bars available, ${cfg.minBarsRequired} required`);
  } else {
    pass('history-depth', `${bars.length} bars`);
  }

  if (rejectedOutliers.length > 0) {
    const byProvider = {};
    for (const o of rejectedOutliers) byProvider[o.provider] = (byProvider[o.provider] || 0) + 1;
    warn(
      'outliers-rejected',
      Object.entries(byProvider)
        .map(([p, n]) => `${p} outvoted on ${n} field(s)`)
        .join('; ')
    );
  }

  const warnLevel = disagreements.filter((d) => !d.fatal).length;
  if (warnLevel > 0) {
    warn('source-spread', `${warnLevel} field(s) differed beyond tolerance; conservative value taken`);
  }

  return {
    symbol,
    verdict,
    bars: verdict === VERDICT.ABSTAIN ? null : bars,
    tradeable: verdict !== VERDICT.ABSTAIN,
    quorum,
    sourcesUsed: sources.map((s) => s.provider),
    checks,
    disagreements,
    rejectedOutliers,
  };
}

module.exports = { buildConsensus, reconcileField, median, FIELDS };
