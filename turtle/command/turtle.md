---
description: Run the end-of-day Turtle trading analysis
---

# /turtle

**Arguments:** `$ARGUMENTS`

This command is a thin wrapper. All logic lives in tested code — there is nothing
here for you to decide, calculate, or interpret.

## What to run

The system lives at `{{TURTLE_DIR}}`. Every command below must run from there, so
prefix each with `cd {{TURTLE_DIR}} && `.

| Argument | Command |
|---|---|
| (none) | `node scripts/turtle.js` |
| `--full` | `node scripts/turtle.js --full` |
| `--markets CAD` / `--markets USD` | `node scripts/turtle.js --markets <value>` |
| `--doctor` | `node scripts/doctor.js` |
| `--backtest` | `node scripts/backtest-cli.js --fetch` |
| `--replay <date>` | `node scripts/turtle.js --replay <date>` |

Run it, then **print the output verbatim**.

## Hard rules

1. **Do not compute anything.** No prices, sizes, stops, ATRs, scores, or
   percentages. If a number is not in the command's output, it does not exist.
2. **Do not add, remove, reorder, or reword any recommendation.** Not to be
   helpful, not to be concise, not because something looks wrong.
3. **Do not name a ticker the output did not name.** If asked about a symbol not
   in the output, say it was not in this run and offer `--full`.
4. **Do not explain away an abstention or a rejection.** They are already stated
   with their reason. Repeat it; do not reinterpret it.
5. **Do not place trades.** There is no broker integration. The user executes on
   Wealthsimple.
6. **If the command exits non-zero, report its stderr verbatim and stop.** Do not
   retry with different flags, do not work around it, do not proceed on partial
   data.

## What you may add

Only these, and only after the verbatim output:

- That warnings exist and what the command said about them.
- The order-placement reminder below, if the output contains a BUY, ADD or SELL.
- An answer to a direct question, sourced from the output only.

## Order placement reminder

For each **BUY**/**ADD**: a limit buy at the stated max price (never a market
order), plus a GTC stop-limit sell at the stated stop/limit the same day.
For **RAISE STOP**: cancel the existing stop-limit, place the new one.
For **SELL**: market sell at the open, then cancel the resting stop.

Prices for US names are in USD; the CAD equivalent is shown alongside.
Wealthsimple GTC orders expire after 90 days.

## Portfolio screenshot

When the user pastes a Wealthsimple positions screenshot:

1. Read it into `[{ symbol, shares, avgPrice }]` using the exact tickers shown.
2. Run `node -e` against `reconcile()` in `{{TURTLE_DIR}}/lib/portfolio.js`, or
   write the parsed array to a temp file and reconcile from there.
3. **Show the diff. Ask for confirmation. Never write state from an unconfirmed
   parse** — one misread share count corrupts sizing, heat, and every subsequent
   stop.
4. On confirmation, apply with `applyFill` / `applyExit` / `appendTrade`.

If a tracked position is absent at the broker it was probably stopped out. Ask
for the actual fill price rather than assuming the stop price: a gap fills below
the stop, and a wrong exit corrupts the R-multiple that forward estimates use.

## First-time setup

```bash
cd {{TURTLE_DIR}}
node scripts/doctor.js              # confirm 2+ data sources per market
node scripts/backtest-cli.js --fetch  # downloads history, must print PASS
```

If doctor reports insufficient sources for a market, say so plainly and stop.
Trading on one unverified source is the failure this system exists to prevent.

## Honesty

- Trend following wins on roughly 35–45% of trades. A losing streak is the
  system working. Never imply otherwise.
- Never promise a return. The forward view is a resampled distribution.
- Never substitute a stale price, a different source, or an estimate for missing
  data. The command already abstains correctly; do not undo that in prose.
