# Setup — macOS laptop, with remote access

No GitHub, no accounts, no package installs. The bundle is self-contained.

---

## 1. Install

Check Node first — 18 or newer is required (it provides the built-in `fetch` the
data layer uses):

```bash
node -v
```

If that errors or shows below v18, install from [nodejs.org](https://nodejs.org)
(the LTS installer) or via Homebrew: `brew install node`.

Then unpack wherever you want it to live:

```bash
mkdir -p ~/trading
tar -xzf turtle-trading.tar.gz -C ~/trading
cd ~/trading/turtle-trading
npm test          # expect: 217 pass, 0 fail
```

There is nothing to install. No dependencies, no build step.

## 2. Make `/turtle` available in Claude Code

```bash
npm run install_command
```

This writes `~/.claude/commands/turtle.md` with this installation's absolute path
baked in, so `/turtle` works from any directory rather than only from this one.
Re-run it if you ever move the folder.

## 3. Verify your data sources

```bash
npm run doctor
```

This is the gate on everything else. It probes each provider against real tickers
in each market and tells you what actually works **on your machine**.

You need **2+ sources per market you intend to trade**. Three is better — with
three, a provider that goes bad gets outvoted instead of stopping the run.

If it reports `INSUFFICIENT`, stop and fix that first. Do not lower
`providers.minSourcesForTrade` in `config.json` to work around it; trading on one
unverified price is the specific failure this system exists to prevent.

## 4. Validate before risking money

```bash
npm run backtest:fetch
```

Downloads roughly five years for the universe (a few minutes, ~300 symbols) and
runs walk-forward validation across three folds. It will skip names loudly —
delisted tickers, stability failures, insufficient sources. Skips are the screen
working.

**The gate must print `PASS`.** It has never passed on real data yet. If it
fails, the failing fold names the regime the rules do not survive — that is
information, not a setback. Do not tune parameters until it passes and then treat
that as validation; that is curve-fitting.

Re-run later with `npm run backtest` (no `:fetch`) to reuse the cached bars, so a
gate result stays reproducible.

## 5. Daily use

```bash
npm run turtle
```

Run it after 16:15 ET. Earlier and it refuses — the current session's bar is
still forming, and acting on a bar that is still moving is the most likely way to
manufacture a phantom breakout.

---

# Remote access

## Recommended: Tailscale + SSH

Tailscale puts your laptop on a private network you can reach from anywhere
without port forwarding, without exposing anything to the public internet, and
without a static IP. Free for personal use.

**On the Mac:**

1. Enable SSH: System Settings → General → Sharing → **Remote Login** on.
2. Install Tailscale from [tailscale.com/download](https://tailscale.com/download)
   and sign in.
3. Note the machine name it shows (e.g. `macbook`).

**On the device you want to connect from** (another laptop, iPad, phone with a
terminal app): install Tailscale, sign in to the same account, then:

```bash
ssh yourusername@macbook
cd ~/trading/turtle-trading
npm run turtle
```

Keep the Mac awake so it is reachable:

```bash
sudo pmset -a sleep 0 disablesleep 1     # undo with disablesleep 0
```

Or plug it in and set System Settings → Displays → Advanced → "Prevent
automatic sleeping when the display is off".

## Simpler, same network only

If you only need access from home, skip Tailscale: enable Remote Login as above
and `ssh yourusername@<mac-local-ip>`. Find the IP in System Settings → Wi-Fi →
Details. This does not work away from home.

## Running Claude Code remotely

Once SSH works, you can run Claude Code on the Mac through that session and use
`/turtle` exactly as you would sitting in front of it. That gives you the
screenshot-reconciliation flow remotely too.

## Optional: scheduled daily run

To have the brief waiting for you rather than running it by hand, use launchd
(the macOS scheduler). Create `~/Library/LaunchAgents/com.turtle.daily.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.turtle.daily</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd ~/trading/turtle-trading &amp;&amp; /usr/local/bin/node scripts/turtle.js &gt;&gt; data/daily.log 2&gt;&amp;1</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>17</integer>
    <key>Minute</key><integer>15</integer>
  </dict>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
```

Load it, and check the node path first since Homebrew installs elsewhere:

```bash
which node                    # put this path in the plist above
launchctl load ~/Library/LaunchAgents/com.turtle.daily.plist
```

The hour is in **your Mac's local time** — set it to whatever 17:15 ET is where
you are (17:15 if you are on Eastern, 14:15 on Pacific). Read the result with
`tail -50 ~/trading/turtle-trading/data/daily.log`.

A scheduled run is a convenience, not an autopilot: it produces recommendations,
it does not place orders, and nothing happens until you act on them.

---

# What lives where

```
config.json           every threshold — risk, stability, providers, FX
data/portfolio.json   your positions (created on first reconciliation)
data/trades.json      closed-trade ledger with R-multiples
data/runs/            one immutable record per run, for audit
data/cache/           downloaded market data
```

**Back up `data/`.** `portfolio.json` and `trades.json` are your actual trading
records — the ledger is also your adjusted-cost-base record for tax, since this
is a non-registered account. Nothing else in the folder is irreplaceable.

Everything under `data/` stays on your machine. The system has no broker
integration, sends nothing anywhere, and cannot place a trade.

# Changing settings

All of it is in `config.json`. The values most worth knowing:

| Key | Default | Meaning |
|---|---|---|
| `account.equity` | 10000 | Book size the risk maths sizes against |
| `risk.riskPerUnitPct` | 0.0075 | 0.75% risked per unit |
| `risk.maxUnitsPerName` | 3 | Pyramid cap |
| `providers.minSourcesForTrade` | 2 | Quorum required to trade a symbol |
| `fx.usdAccount` | false | Set true if you fund a Wealthsimple USD account |
| `stability.*` | — | The screen that rejects unstable tickers |

After editing, run `npm test` to confirm nothing broke, then `npm run backtest`
to see what the change does to the gate before trusting it live.
