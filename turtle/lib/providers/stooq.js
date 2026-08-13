'use strict';

const { fetchText } = require('../http');

/**
 * Stooq daily CSV endpoint.
 *
 * Returns `Date,Open,High,Low,Close,Volume` with an ISO date column. Stooq
 * suffixes tickers by market: `.us` for United States listings and `.ca` for
 * Toronto.
 *
 * NOTE ON THE CANADIAN SUFFIX: the `.us` convention is well established; the
 * Canadian one is asserted here but has NOT been verified against the live
 * endpoint from the machine this was written on, because egress to Stooq was
 * blocked there. Run `npm run turtle:doctor` to find out what actually works on
 * your machine — it reports per-provider, per-market reachability instead of
 * assuming. If Canadian coverage fails, Stooq simply drops out of the provider
 * set for those names and the run continues on the remaining sources.
 */

const NAME = 'stooq';

function symbolFor(entry) {
  // Stooq lowercases and uses hyphens for share classes, as Yahoo does.
  const base = entry.symbol.toLowerCase().replace(/\./g, '-');
  return entry.currency === 'CAD' ? `${base}.ca` : `${base}.us`;
}

/**
 * Parse Stooq's CSV.
 *
 * Stooq answers an unknown symbol with a 200 and a body of "No data" rather
 * than a 404, so an empty or headerless parse must be treated as a miss.
 */
function parse(csv) {
  const text = (csv || '').trim();
  if (!text || /^no data/i.test(text)) {
    return { ok: false, error: 'provider reports no data for this symbol' };
  }

  const lines = text.split(/\r?\n/);
  const header = lines[0].toLowerCase().split(',');
  const col = {
    date: header.indexOf('date'),
    open: header.indexOf('open'),
    high: header.indexOf('high'),
    low: header.indexOf('low'),
    close: header.indexOf('close'),
    volume: header.indexOf('volume'),
  };
  if (Object.values(col).some((i) => i === -1)) {
    return { ok: false, error: `unexpected CSV header: ${lines[0]}` };
  }

  const bars = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(',');
    if (parts.length < 6) continue;

    const o = Number(parts[col.open]);
    const h = Number(parts[col.high]);
    const l = Number(parts[col.low]);
    const c = Number(parts[col.close]);
    const v = Number(parts[col.volume]);
    const date = parts[col.date];

    if (![o, h, l, c].every(Number.isFinite)) continue;
    if (!Number.isFinite(v) || v <= 0) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    // Stooq gives a date with no time. Stamp it at 14:30Z, near a North American
    // session open, so exchange-local date bucketing matches the other providers.
    bars.push({ t: `${date}T14:30:00.000Z`, o, h, l, c, v });
  }

  if (bars.length === 0) return { ok: false, error: 'no usable rows in CSV' };
  bars.sort((a, b) => (a.t < b.t ? -1 : 1));
  return { ok: true, bars };
}

async function fetchDaily(entry, { timeoutMs } = {}) {
  const symbol = symbolFor(entry);
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;

  const response = await fetchText(url, { timeoutMs });
  if (!response.ok) {
    return { ok: false, provider: NAME, symbol, error: response.error, status: response.status };
  }

  const parsed = parse(response.body);
  return parsed.ok
    ? { ok: true, provider: NAME, symbol, bars: parsed.bars, ms: response.ms }
    : { ok: false, provider: NAME, symbol, error: parsed.error };
}

module.exports = { name: NAME, symbolFor, parse, fetchDaily, supports: () => true };
