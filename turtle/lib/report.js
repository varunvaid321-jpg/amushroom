'use strict';

/**
 * Renders the daily brief.
 *
 * Two rules govern what goes on the page:
 *
 * 1. Every action carries the exact numbers needed to place it — share count,
 *    maximum price, stop and limit. A brief you have to interpret is a brief
 *    that produces execution errors.
 * 2. Rejections are shown with their reason. "Nothing to do today" is far less
 *    trustworthy than "these four names signalled and here is precisely why each
 *    was declined", and the second version is what lets you catch a filter that
 *    has gone wrong.
 */

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const dollars = (v) =>
  `$${v.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pad = (s, n) => String(s).padEnd(n);

function renderHeader(d) {
  const lines = [];
  const integrity =
    d.sourcesAgreed >= 4
      ? 'bars FINAL, 4 sources agreed'
      : `bars FINAL, ${d.sourcesAgreed} source(s) verified`;
  lines.push(`TURTLE — ${d.date} (TSX closed, ${integrity})`);

  const regime = d.regime.riskOn
    ? `RISK-ON (${d.regime.benchmarkSymbol} ${pct(d.regime.distanceToSmaPct / 100)} above SMA200)`
    : `RISK-OFF — no new entries`;
  lines.push(
    `Equity ${dollars(d.equity)} · Deployed ${dollars(d.deployed)} (${pct(d.deployedPct)}) · ` +
      `Open heat ${pct(d.heatPct)} of ${pct(d.heatCapPct)} cap · Regime: ${regime}`
  );
  if (d.regime.highVol) {
    lines.push(`  ⚠ elevated volatility regime — risk per unit halved this run`);
  }
  return lines.join('\n');
}

function renderAction(action, i) {
  const lines = [];
  switch (action.type) {
    case 'BUY':
    case 'ADD': {
      const label = action.type === 'ADD' ? 'ADD ' : 'BUY ';
      lines.push(
        `${i}. ${label} ${action.symbol}   ${action.shares} sh @ max ${dollars(action.maxPrice)}   ` +
          `(System ${action.system}, ${action.system === 2 ? 55 : 20}-day breakout)`
      );
      lines.push(
        `   Cost up to ${dollars(action.notional)}  ·  N=${dollars(action.n)}  ·  ` +
          `Unit ${action.unit} of ${action.maxUnits}  ·  risk ${dollars(action.risk)} (${pct(action.riskPct)})`
      );
      lines.push(
        `   → Place GTC stop-limit: stop ${dollars(action.stop)} / limit ${dollars(action.limit)}   ← same day`
      );
      if (action.nextAdd) {
        lines.push(`   Add unit ${action.unit + 1} if it trades ${dollars(action.nextAdd)} (+0.5N).`);
      }
      if (action.expectation && action.expectation.ok) {
        const e = action.expectation;
        lines.push(
          `   Expect: ${pct(e.winRate)} win rate, median hold ${e.medianHoldWinners}d, ` +
            `${e.expectedR.toFixed(2)}R expected (${e.sample} analogues)`
        );
      } else if (action.expectation) {
        lines.push(`   Expect: no stable estimate — ${action.expectation.reason}`);
      }
      break;
    }
    case 'SELL':
      lines.push(`${i}. SELL ${action.symbol}   all ${action.shares} sh at open`);
      lines.push(`   ${action.reason}`);
      lines.push(
        `   Realised ${action.r === null ? 'n/a' : `${action.r.toFixed(2)}R`} ` +
          `(${action.pnl >= 0 ? '+' : ''}${dollars(action.pnl)})` +
          `${action.r !== null && action.r < 0 ? ' — working as designed' : ''}`
      );
      lines.push(`   → Cancel the resting stop-limit for ${action.symbol} once filled.`);
      break;
    case 'RAISE_STOP':
      lines.push(
        `${i}. RAISE STOP  ${action.symbol}   ${dollars(action.from)} → ${dollars(action.to)}  ` +
          `(${action.source}, ${action.lockedR.toFixed(1)}R locked)`
      );
      lines.push(
        `   → Cancel and replace the GTC stop-limit: stop ${dollars(action.to)} / limit ${dollars(action.limit)}`
      );
      break;
    default:
      lines.push(`${i}. ${action.type} ${action.symbol}`);
  }
  return lines.join('\n');
}

function renderForward(projection) {
  if (!projection || !projection.ok) {
    return `── FORWARD VIEW ─────────────────────────────────────────\n${
      projection && projection.reason
        ? `Unavailable: ${projection.reason}`
        : 'Unavailable: no validated backtest to project from'
    }`;
  }
  const p = projection.returnPercentiles;
  return [
    '── FORWARD VIEW ─────────────────────────────────────────',
    `Next ${projection.horizonDays} sessions, ${projection.paths} bootstrap paths, ~${projection.expectedTrades} trades:`,
    `  median ${pct(p.p50)} · 25th ${pct(p.p25)} · 75th ${pct(p.p75)} · 5th ${pct(p.p5)} · 95th ${pct(p.p95)}`,
    `  P(loss) ${pct(projection.probabilityOfLoss)} · P(drawdown >10%) ${pct(
      projection.probabilityOfDrawdown[0.1]
    )} · P(>20%) ${pct(projection.probabilityOfDrawdown[0.2])}`,
    `  median hold: winners ${projection.medianHoldWinners}d, losers ${projection.medianHoldLosers}d`,
    '',
    '  Resampled from backtested outcomes. Trade ORDER is randomised on purpose —',
    '  only the distribution is meaningful, never a single path.',
  ].join('\n');
}

function render(decision) {
  const out = [renderHeader(decision), ''];

  if (decision.actions.length > 0) {
    out.push('── ACTIONS ──────────────────────────────────────────────');
    decision.actions.forEach((action, i) => {
      out.push(renderAction(action, i + 1));
      out.push('');
    });
  } else {
    out.push('── ACTIONS ──────────────────────────────────────────────');
    out.push('None. Holding current positions unchanged.');
    out.push('');
  }

  if (decision.noAction.length > 0) {
    out.push('── NO ACTION ────────────────────────────────────────────');
    for (const item of decision.noAction) {
      out.push(`${pad(item.symbol, 10)} ${item.reason}`);
    }
    out.push('');
  }

  // Abstentions are printed separately and prominently: a symbol dropped for
  // data reasons is not the same as one rejected on its merits, and conflating
  // the two would hide a data outage behind a quiet day.
  if (decision.abstained.length > 0) {
    out.push('── EXCLUDED ON DATA INTEGRITY ───────────────────────────');
    for (const item of decision.abstained) {
      out.push(`${pad(item.symbol, 10)} ${item.reason}`);
    }
    out.push('  These were not evaluated. No recommendation is made on unverified prices.');
    out.push('');
  }

  out.push(renderForward(decision.forward));

  if (decision.warnings && decision.warnings.length > 0) {
    out.push('');
    out.push('── WARNINGS ─────────────────────────────────────────────');
    for (const w of decision.warnings) out.push(`  ⚠ ${w}`);
  }

  return out.join('\n');
}

module.exports = { render, renderHeader, renderAction, renderForward };
