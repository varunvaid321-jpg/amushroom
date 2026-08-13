# Turtle Trading System — $10k CAD, Wealthsimple

A mechanical trend-following system. Run one command after the close, get exact
orders, place them on Wealthsimple, feed your portfolio back so it manages exits
and pyramids.

Runs standalone on a laptop with **Node 18+ and nothing else** — no install, no
API keys, no service, no account anywhere.

```bash
npm run turtle:doctor    # first: confirm data sources are reachable here
npm run turtle           # daily run
```

## What it promises, and what it does not

**It guarantees process.** Prices are cross-verified across independent
providers, and nothing is recommended on unverified data. Sizing is deterministic
and unit-tested. Risk caps are enforced before a suggestion reaches you.
Re-running against the same inputs reproduces byte-identical output, so any past
recommendation can be audited.

**It does not guarantee profits.** Trend following wins on roughly 35–45% of
trades and makes money because winners run much longer than losers. Eight to
twelve consecutive losses is normal. At 0.75% risk per unit, expect drawdowns in
the 15–22% range. A losing streak is the system working, not breaking.

**Nothing goes live until the walk-forward gate passes.** Every brief warns
loudly until it does.

## Staying up when a source goes down

No single provider can stop a run. Every symbol is fetched from all providers in
parallel — not a try-the-next-one chain, because the goal is not the *first*
answer but as many *independent* answers as possible to compare.

| Sources | Behaviour |
|---|---|
| 3+ | A rogue provider is **outvoted** and dropped for the affected bars. Its failure costs one source, not the run. |
| 2 | Tradeable. A material disagreement abstains, because there is no majority to decide which side is right. |
| 1 | Reported but **not tradeable**. One source is not verification. |
| 0 | Abstains. The scan continues for every other symbol. |

Providers: **Yahoo Finance**, **Stooq**, and **IBKR** (when running inside Claude
Code with the MCP server attached — broker-grade consolidated tape, so a
genuinely different kind of check rather than another copy of the same upstream).

On any disagreement the conservative value is taken: higher high, lower low,
lower open, lower close, lower volume. Every choice biases toward not trading and
toward assuming a stop was hit.

`npm run turtle:doctor` reports what is actually reachable **on your machine**
rather than assuming. Run it first, and any time a run reports odd abstentions.

## Stability screening

Trend following does not need exciting names — it needs names whose risk can be
measured. A stock that routinely gaps 20% overnight breaks the assumption the
whole system rests on: that a 2N stop is a meaningful boundary. When price jumps
straight through it, "0.75% risk per unit" is fiction.

Rejected automatically, with the failing measurement named:

| Check | Default |
|---|---|
| Listing history | ≥ 400 sessions |
| Share price | ≥ $5 |
| Annualised volatility | ≤ 60% |
| Sessions gapping >5% | ≤ 2% |
| Largest single-day move | ≤ 20% |
| Zero-volume sessions | 0 |
| Median daily value | ≥ $5M |
| Consecutive identical closes | ≤ 3 (stale feed) |

All thresholds live in `config.json`. None are decided at runtime.

## Currencies

The account is CAD. US listings are sized, capped and risked in CAD while their
prices, ATR and stops stay in USD — the brief labels every foreign number and
shows the CAD equivalent.

FX cost is charged in **R**, not in percent:

```
fxDragR = (round-trip conversion cost x entry price) / 2N
```

A 3% round trip on a $100 stock with an $8 stop costs 0.375R before the trade
does anything. Comparing 3% against an expected *return* would be meaningless;
what matters is its size relative to the risk being taken. A US name must clear a
visibly higher bar than a TSX name, and one with a tight stop is rejected
outright as uneconomic. Set `fx.usdAccount: true` if you fund a USD account.

## The rules

**Entries** — Donchian breakout on the close. System 2 (55-day) is primary and
unfiltered. System 1 (20-day) fires only when the previous System 1 breakout on
that name lost — the original Turtle whipsaw filter.

**Quality gates** — a new entry also needs Kaufman Efficiency Ratio ≥ 0.30,
ADX(14) ≥ 20, and a 60-day log-price regression with R² ≥ 0.50 and positive
slope. These never apply to exits: once in a trade you leave on the rules.

**Exits** — the Donchian exit (10-day low for System 1, 20-day for System 2) is
the real exit and normally fires first. The resting 2N stop is disaster insurance
for gaps and for days you do not run the tool.

**Regime** — no new entries while XIC is below its 200-day SMA. Long-only trend
following in a bear market is just owning the index down; cash is the only hedge
available here.

**Sizing** — capital-constrained. Share count comes from the 2N stop distance and
is fill-independent; the notional cap is evaluated at the worst acceptable price.
Names that cannot be sized are rejected with a reason.

| Setting | Value |
|---|---|
| Risk per unit | 0.75% of equity |
| Max units per name | 3, pyramided at 0.5N |
| Stop | 2N, ratcheting, resting GTC stop-limit |
| Portfolio heat cap | 6% |
| Single-name notional | 25% |
| Sector cap | 2 positions |
| Cash buffer | 15% minimum |
| Direction | Long only |

## Commands

```bash
npm run turtle              # daily brief
npm run turtle:doctor       # what data sources work here
npm run turtle:test         # 214 tests
npm run turtle:backtest     # walk-forward gate (needs cached bars)
npm run turtle:install      # install /turtle (the repo gitignores .claude)

node turtle/scripts/turtle.js --full            # scan the whole universe
node turtle/scripts/turtle.js --markets CAD     # one market only
node turtle/scripts/turtle.js --replay <date>   # re-decide from cache
```

## Architecture

```
lib/http.js         no-dep fetch: timeouts, retries, bounded concurrency
lib/providers/      yahoo, stooq, ibkr-cache + parallel registry
lib/consensus.js    N-source agreement, outlier rejection, quorum
lib/integrity.js    session gate, OHLC invariants, corporate actions
lib/stability.js    ticker stability screening
lib/fx.js           USD/CAD, FX cost expressed in R
lib/indicators.js   Wilder ATR, Donchian, ADX, Kaufman ER, regression
lib/signals.js      entries, exits, whipsaw filter, quality gates
lib/sizing.js       unit sizing, pyramids, stops, stop-limit pairs
lib/risk.js         heat, sector and correlation caps, regime filter
lib/ranking.js      cross-sectional scoring
lib/engine.js       decide() — the single decision path
lib/backtest.js     event-driven backtester and walk-forward gate
lib/montecarlo.js   bootstrap forward projection
lib/portfolio.js    state, reconciliation, trade ledger
lib/report.js       the daily brief
scripts/turtle.js   the entrypoint
scripts/doctor.js   provider diagnostics
```

Every entrypoint calls the same `decide()`. Two decision paths would eventually
disagree, and a recommendation that cannot be reproduced is worse than none.

Trading state and raw market data stay local and gitignored.

## Before trading live

1. `npm run turtle:doctor` — 2+ sources must be reachable per market you trade.
2. `npm run turtle:backtest` — the gate must print **PASS**.
3. Paper-run for ten sessions, recording recommendations without trading, to
   confirm the session gate behaves around holidays and that source
   disagreements surface in the wild.
4. Confirm on your account: whether TSX fractional shares are available (the
   system assumes whole shares) and that the GTC toggle appears on stop-limits.
