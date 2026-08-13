---
description: Run the end-of-day Turtle trading analysis for the $10k CAD TSX book
---

# /turtle

Run the end-of-day Turtle trend-following analysis and produce the daily brief.

**Arguments:** `$ARGUMENTS`
- (none) — normal daily run
- `--full` — rescreen the entire universe instead of the active watchlist
- `--backtest` — fetch history and run walk-forward validation
- `--setup` — resolve the TSX universe from scratch
- a pasted portfolio screenshot — reconcile broker state

---

## Non-negotiable rules

1. **Never invent, estimate, or fill in a price.** Every price comes from the
   IBKR MCP tools and is written to the cache verbatim. If a fetch fails, the
   symbol is omitted and the engine abstains on it. Abstaining is always correct;
   guessing never is.
2. **Never edit the engine's output.** `run.js` produces the recommendation.
   Relay it. Do not add trades it did not recommend, soften a rejection, or
   adjust a share count, stop, or price.
3. **Never update `portfolio.json` without explicit user confirmation.** Screenshot
   reconciliation produces a diff for the user to approve, never a silent write.
4. **The engine does the maths, you do the fetching.** All computation lives in
   tested Node modules. Your job is data acquisition, presentation, and state
   updates the user has confirmed.
5. **Do not place trades.** This system recommends; the user executes on
   Wealthsimple. There is no broker integration and there must not be one.

---

## Step 1 — Confirm the session has settled

The TSX closes at 16:00 ET. IBKR returns the current day's bar *while it is still
forming*, and that bar keeps changing — acting on it is the most likely way to
produce a phantom breakout.

Check the current time in `America/Toronto`. If it is before **16:15 ET on a
trading day**, tell the user the session has not settled and stop. Do not fetch,
do not analyse. The engine would refuse anyway; failing early is clearer.

## Step 2 — Determine what to fetch

Read `turtle/data/portfolio.json` for open positions (absent on a first run).

Build the fetch list:
- **Always**: `XIC` (the regime benchmark — the run aborts without it) and every
  open position.
- **Daily run**: the active watchlist in `turtle/data/watchlist.json` if present,
  otherwise the first 40 symbols of `turtle/universe/tsx-universe.json`.
- **`--full`**: every symbol in `tsx-universe.json`.

Fetching is the slow part. Keep the daily list near 40 names plus positions.

## Step 3 — Fetch and cache

For each symbol, call the IBKR MCP tools and write **one file per symbol** to
`turtle/data/cache/<YYYY-MM-DD>/<SYMBOL>.json` (replace `.` with `_` in
filenames, e.g. `TECK_B.json`):

```json
{
  "primary":   { /* get_price_history: step ONE_DAY, step_count 300, outside_rth false */ },
  "secondary": { /* same, plus exchange: "TSE" */ },
  "hourly":    { /* step ONE_HOUR, step_count 40 — shortlist and positions only */ },
  "snapshot":  { /* get_price_snapshot */ }
}
```

Write the responses **exactly as returned**. Do not reshape, round, or merge them
— the cache is the audit trail, and the engine parses the raw format.

`primary` is required. `secondary` costs one extra call and is what catches a
bad print, so fetch it for every symbol. `hourly` and `snapshot` are for open
positions and breakout candidates, where accuracy actually decides money.

For `snapshot`, request:
`["last", "bid_ask", "volume", "misc_statistics", "avg_90d_usd_volume", "historical_vol"]`.
Note `prior_close` returns empty and is not used.

## Step 4 — Run the engine

```bash
node turtle/scripts/run.js
```

It runs the integrity ladder, applies the rules, writes an audit record to
`turtle/data/runs/<date>.json`, and prints the brief.

**Relay the brief verbatim.** Then add, in your own words only:
- Which symbols were excluded on data integrity and what that means practically
- Any warnings that need the user's attention

If the engine exits non-zero, report the reason plainly. Do not work around it.

## Step 5 — Order placement guidance

For each BUY or ADD, the user places two orders on Wealthsimple:
1. A **limit buy** at the stated max price (never a market order — the max price
   is what keeps the trade inside the backtested distribution).
2. A **GTC stop-limit sell** at the stated stop/limit, the same day.

For RAISE STOP, the user cancels the existing stop-limit and places the new one.
For SELL, a market sell at the open, then cancel the resting stop.

Remind the user that Wealthsimple GTC orders expire after 90 days.

## Step 6 — Portfolio reconciliation

When the user pastes a screenshot of their Wealthsimple positions:

1. Read it into `[{ symbol, shares, avgPrice }]`. Use the exact ticker as shown.
2. Compare against `turtle/data/portfolio.json` using `reconcile()` from
   `turtle/lib/portfolio.js`.
3. **Show the diff and ask for confirmation.** Never write state from an
   unconfirmed parse — one bad OCR read of a share count corrupts sizing, heat,
   and every stop that follows.
4. On confirmation, apply via `applyFill` / `applyExit`, append closed trades
   with `appendTrade`, and save.

If a tracked position is missing at the broker, it was almost certainly stopped
out. Ask the user for the fill price rather than assuming the stop price — a gap
fills below the stop, and recording the wrong exit corrupts the R-multiple that
future forward estimates are built on.

## Step 7 — Backtest (`--backtest`)

1. Fetch `step ONE_DAY, period FIVE_YEARS` for every universe symbol plus `XIC`
   into `turtle/data/cache/bars/<SYMBOL>.json` (the raw response).
2. Run `npm run turtle:backtest`.
3. Relay the gate result in full.

**If the gate fails, say so plainly and tell the user not to trade the
configuration live.** A failing fold identifies a regime the rules do not
survive. Do not tune parameters until the gate passes and then present that as
validation — that is curve-fitting, and it produces a system that works
perfectly on the past and fails on the future.

## Step 8 — Universe setup (`--setup`)

1. `node turtle/scripts/resolve-universe.js --missing` for the ticker list.
2. Call `search_contracts` for each and write the raw response to
   `turtle/data/cache/universe-search/<SYMBOL>.json`.
3. `npm run turtle:universe`.
4. Report resolved and rejected counts. Rejections are expected — acquired,
   renamed and delisted tickers are pruned here by design.

---

## Honesty requirements

- Trend following wins on roughly 35–45% of trades. A run of losses is the system
  working, not failing. Never imply otherwise.
- Never promise a return. The forward view is a resampled distribution and must
  always be presented as one.
- If a data source is unavailable, say so and abstain. Never substitute a
  different source, a stale price, or an estimate.
- If the user asks for a trade the rules did not generate, explain what the rules
  say. They can override it — it is their account — but the system's
  recommendation must not be restated as if it endorsed the trade.
