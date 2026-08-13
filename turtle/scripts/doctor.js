#!/usr/bin/env node
'use strict';

/**
 * Verify what actually works on THIS machine.
 *
 * Provider endpoints change, get blocked by networks, rate-limit by region, and
 * carry different market coverage. Rather than assume any of that, this probes
 * each provider against a known ticker in each market and reports what it finds.
 *
 * The critical number it reports is how many INDEPENDENT sources are reachable
 * per market. Two is the minimum to trade; three is what lets a bad provider be
 * outvoted instead of stopping the run.
 *
 * Run this first, and again any time a run reports unusual abstentions.
 */

const path = require('node:path');
const config = require('../config.json');
const { REGISTRY, providersFor } = require('../lib/providers');
const { fetchUsdCadRate } = require('../lib/fx');
const { buildConsensus } = require('../lib/consensus');

const ROOT = path.join(__dirname, '..');

// Large, long-listed names that every provider should carry if it works at all.
const PROBES = [
  { symbol: 'RY', name: 'Royal Bank of Canada', currency: 'CAD', market: 'TSX' },
  { symbol: 'ENB', name: 'Enbridge', currency: 'CAD', market: 'TSX' },
  { symbol: 'AAPL', name: 'Apple', currency: 'USD', market: 'US' },
  { symbol: 'MSFT', name: 'Microsoft', currency: 'USD', market: 'US' },
];

const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function probeProvider(provider, entry) {
  const started = Date.now();
  try {
    const result = await provider.fetchDaily(entry, {
      dataRoot: ROOT,
      days: config.providers.historyDays,
      timeoutMs: config.providers.timeoutMs,
    });
    const ms = Date.now() - started;

    if (!result.ok) return { ok: false, ms, error: result.error };
    const bars = result.bars;
    return {
      ok: true,
      ms,
      bars: bars.length,
      lastDate: bars[bars.length - 1].t.slice(0, 10),
      lastClose: bars[bars.length - 1].c,
      mappedSymbol: result.symbol,
    };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, error: error.message };
  }
}

async function main() {
  process.stdout.write('\nTURTLE DOCTOR — verifying data sources on this machine\n');
  process.stdout.write('='.repeat(72) + '\n\n');

  const major = Number(process.versions.node.split('.')[0]);
  process.stdout.write(`Node ${process.versions.node}  `);
  if (major >= 18) {
    process.stdout.write(ok('OK') + dim('  (built-in fetch available)') + '\n');
  } else {
    process.stdout.write(bad('TOO OLD') + '  Node 18+ is required for built-in fetch\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Platform ${process.platform} ${process.arch}\n\n`);

  const providers = providersFor(config);
  process.stdout.write(
    `Enabled providers: ${providers.map((p) => p.name).join(', ')}\n` +
      `Quorum required to trade: ${config.providers.minSourcesForTrade} independent sources\n\n`
  );

  // ---- Per-provider probes ----------------------------------------------
  const reachable = { CAD: new Set(), USD: new Set() };

  for (const entry of PROBES) {
    process.stdout.write(`${entry.symbol} (${entry.market}, ${entry.currency}) — ${entry.name}\n`);

    for (const provider of providers) {
      const result = await probeProvider(provider, entry);
      const label = `  ${provider.name.padEnd(12)}`;

      if (result.ok) {
        reachable[entry.currency].add(provider.name);
        process.stdout.write(
          `${label}${ok('OK'.padEnd(6))}${String(result.bars).padStart(5)} bars  ` +
            `last ${result.lastDate} @ ${result.lastClose.toFixed(2)}  ` +
            dim(`${result.mappedSymbol || ''} ${result.ms}ms`) +
            '\n'
        );
      } else {
        process.stdout.write(`${label}${bad('FAIL'.padEnd(6))}${dim(result.error)}\n`);
      }
    }
    process.stdout.write('\n');
  }

  // ---- Consensus feasibility --------------------------------------------
  process.stdout.write('-'.repeat(72) + '\n');
  process.stdout.write('SOURCE AVAILABILITY\n\n');

  let fatal = false;
  for (const currency of ['CAD', 'USD']) {
    const count = reachable[currency].size;
    const names = [...reachable[currency]].join(', ') || 'none';
    const need = config.providers.minSourcesForTrade;

    let verdict;
    if (count >= 3) verdict = ok('EXCELLENT') + ' — a bad provider can be outvoted';
    else if (count >= need) verdict = ok('OK') + ' — tradeable, but a disagreement cannot be resolved';
    else {
      verdict = bad('INSUFFICIENT') + ` — ${need} required, trading is blocked for this market`;
      fatal = true;
    }

    process.stdout.write(`  ${currency}: ${count} source(s) [${names}]\n         ${verdict}\n\n`);
  }

  // ---- FX ----------------------------------------------------------------
  process.stdout.write('-'.repeat(72) + '\n');
  process.stdout.write('FX RATE\n\n');
  const fxResult = await fetchUsdCadRate({ timeoutMs: config.providers.timeoutMs });
  if (fxResult.ok) {
    process.stdout.write(`  USD/CAD ${ok(fxResult.rate.toFixed(4))} from ${fxResult.source}\n\n`);
  } else {
    process.stdout.write(
      `  ${bad('FAIL')} ${fxResult.error}\n` +
        `  US trades cannot be sized without this. CAD trading is unaffected.\n\n`
    );
  }

  // ---- Live consensus check ---------------------------------------------
  process.stdout.write('-'.repeat(72) + '\n');
  process.stdout.write('CONSENSUS CHECK (live data, RY)\n\n');

  const entry = PROBES[0];
  const sources = [];
  for (const provider of providers) {
    const result = await provider.fetchDaily(entry, {
      dataRoot: ROOT,
      days: config.providers.historyDays,
      timeoutMs: config.providers.timeoutMs,
    });
    if (result.ok) sources.push(result);
  }

  if (sources.length === 0) {
    process.stdout.write(`  ${bad('No sources returned data.')}\n\n`);
  } else {
    const consensus = buildConsensus({ symbol: entry.symbol, sources, config, now: new Date() });
    process.stdout.write(`  verdict  ${consensus.verdict}\n`);
    process.stdout.write(`  quorum   ${consensus.quorum} source(s) on the decision bar\n`);
    for (const check of consensus.checks) {
      const mark = check.passed ? (check.warning ? '~' : '+') : '-';
      process.stdout.write(`  ${mark} ${check.name.padEnd(20)} ${dim(check.detail)}\n`);
    }
    if (consensus.disagreements.length > 0) {
      const worst = Math.max(...consensus.disagreements.map((d) => d.bps));
      process.stdout.write(
        `  ${consensus.disagreements.length} field(s) disagreed, worst ${worst.toFixed(1)}bps\n`
      );
    }
    process.stdout.write('\n');
  }

  process.stdout.write('-'.repeat(72) + '\n');
  if (fatal) {
    process.stdout.write(
      bad('RESULT: not ready.') +
        ' At least one market has too few reachable sources.\n' +
        'Check network access to the provider hosts, or reduce\n' +
        'providers.minSourcesForTrade in config.json only if you accept\n' +
        'trading on unverified prices — which is not recommended.\n\n'
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(ok('RESULT: ready.') + ' Sufficient independent sources are reachable.\n\n');
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`doctor failed: ${error.stack}\n`);
    process.exitCode = 1;
  });
}
