# Turtle Trading System — $10k CAD, TSX-only, Wealthsimple

A mechanical trend-following system. You run `/turtle` after the close, it hands
you exact orders, you place them on Wealthsimple, and you feed your portfolio
back so it can manage exits and pyramids.

## What it promises, and what it does not

**It guarantees process.** Prices are cross-verified across independent sources
and the system refuses to recommend anything on unverified data. Sizing is
deterministic and unit-tested. Risk caps are enforced before a suggestion ever
reaches you. Re-running the engine on a cached day reproduces the identical
recommendation, so any past call can be audited.

**It does not guarantee profits.** Trend following wins on roughly 35–45% of
trades and makes money because winners run much longer than losers. Eight to
twelve consecutive losses is normal. At 0.75% risk per unit, expect drawdowns
in the 15–22% range. A losing streak is the system working, not breaking.

**Nothing goes live until the walk-forward gate passes.** The engine warns loudly
on every brief until it does.

## Configuration

| Setting | Value |
|---|---|
| Universe | TSX only, CAD — no FX drag |
| Risk per unit | 0.75% of equity |
| Max units per name | 3 (pyramided at 0.5N intervals) |
| Stop | 2N, ratcheting, resting GTC stop-limit at the broker |
| Portfolio heat cap | 6% |
| Single-name notional cap | 25% |
| Sector cap | 2 positions |
| Cash buffer | 15% minimum |
| Direction | Long only |
| Account | Non-registered (taxable) |

All in `config.json`.

## The rules

**Entries** — Donchian breakout on the close. System 2 (55-day) is primary and
unfiltered. System 1 (20-day) fires only when the previous System 1 breakout on
that name lost, the original Turtle whipsaw filter.

**Quality gates** — a new entry additionally requires Kaufman Efficiency Ratio
≥ 0.30, ADX(14) ≥ 20, and a 60-day log-price regression with R² ≥ 0.50 and
positive slope. These do not apply to exits: once in a trade you leave on the
rules, never on a score.

**Exits** — two layers. The Donchian exit (10-day low for System 1, 20-day for
System 2) is the real exit and normally fires first. The resting 2N stop is
disaster insurance for gaps and for days you do not run the tool.

**Regime** — no new entries while XIC sits below its 200-day SMA. Long-only trend
following in a bear market is just owning the index down, and cash is the only
hedge available here.

**Sizing** — capital-constrained. Share count comes from the 2N stop distance and
is fill-independent; the notional cap is evaluated at the worst acceptable price.
Names that cannot be sized (a $3,000 share against a $75 unit budget) are
rejected with a reason rather than silently skipped.

## Data integrity

Every symbol that could produce an action passes four checks: a session-closed
gate, structural invariants, native-exchange reconciliation, hourly-to-daily
cross-timeframe aggregation, and a snapshot envelope test.

On **any** disagreement between sources the conservative value is adopted — the
higher high, the lower low, the lower close. Real observed SMART vs
native-exchange disagreement ran ~12bps, under the warn threshold yet easily
enough to flip a breakout. Beyond 50bps the symbol is dropped entirely.

An abstained symbol returns no prices at all, so an untrusted number cannot leak
into a downstream calculation.

## Commands

This repo gitignores `.claude`, so the slash command is not durable there. The
canonical copy lives at `turtle/command/turtle.md` and is installed with:

```bash
npm run turtle:install      # copy /turtle into .claude/commands/
```

Run it after cloning, and again whenever `turtle/command/turtle.md` changes.

```bash
/turtle                     # daily brief
/turtle --full              # rescreen the whole universe
/turtle --backtest          # walk-forward validation and the go/no-go gate
/turtle --setup             # resolve the TSX universe

npm run turtle:test         # 154 tests
npm run turtle:check        # syntax
npm run turtle:backtest     # gate (needs cached bars)
npm run turtle:universe     # resolve universe from cached searches
```

## Architecture

MCP tools belong to the Claude session, not to Node. So the session **fetches and
caches**; a dependency-free, unit-tested Node engine does **all** computation. No
indicator or sizing decision is ever made by the model. That split is what makes
the system reproducible rather than dependent on what an API returned that
afternoon.

```
lib/indicators.js   Wilder ATR, Donchian, ADX, Kaufman ER, regression, correlation
lib/signals.js      System 1 & 2 entries/exits, whipsaw filter, quality gates
lib/sizing.js       unit sizing, pyramids, stops, stop-limit pairs
lib/risk.js         heat, sector and correlation caps, regime filter
lib/ranking.js      cross-sectional scoring when signals compete for capital
lib/integrity.js    the verification ladder
lib/backtest.js     event-driven backtester and walk-forward gate
lib/montecarlo.js   bootstrap forward projection
lib/portfolio.js    state, reconciliation, trade ledger
lib/report.js       the daily brief
scripts/run.js      engine entrypoint
```

Trading state and raw market data stay local and gitignored. The resolved
universe is committed so a later backtest resolves the same contracts.

## Before trading live

1. `/turtle --setup` — resolve the universe.
2. `/turtle --backtest` — the gate must print **PASS**.
3. Paper-run `/turtle` for ten sessions, recording recommendations without
   trading, to confirm the session gate behaves around holidays and that source
   disagreements surface in the wild.
4. Confirm on your account: whether TSX fractional shares are available (the
   system assumes whole shares), and that the GTC toggle appears on TSX
   stop-limit orders.
