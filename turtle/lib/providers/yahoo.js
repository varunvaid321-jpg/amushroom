'use strict';

const { fetchJson } = require('../http');

/**
 * Yahoo Finance chart endpoint.
 *
 * Symbol conventions Yahoo uses, which differ from IBKR's:
 *   - Toronto listings carry a `.TO` suffix        SHOP    -> SHOP.TO
 *   - Share classes use a hyphen, not a dot        TECK.B  -> TECK-B.TO
 *   - REIT units follow the same hyphen rule       REI.UN  -> REI-UN.TO
 *   - US listings are bare, classes hyphenated     BRK.B   -> BRK-B
 *
 * Translating these wrongly does not throw — it silently fetches a DIFFERENT
 * instrument or returns empty. That is precisely why no single provider is ever
 * trusted alone and why the consensus layer requires agreement.
 */

const NAME = 'yahoo';

function symbolFor(entry) {
  const base = entry.symbol.replace(/\./g, '-');
  return entry.currency === 'CAD' ? `${base}.TO` : base;
}

/** Yahoo accepts a fixed set of range tokens; pick the smallest that covers `days`. */
function rangeFor(days) {
  if (days <= 30) return '1mo';
  if (days <= 90) return '3mo';
  if (days <= 180) return '6mo';
  if (days <= 365) return '1y';
  if (days <= 730) return '2y';
  if (days <= 1825) return '5y';
  return '10y';
}

/**
 * Parse a chart response into bars.
 *
 * Yahoo pads its arrays with nulls for sessions it has no data for. Those must
 * be dropped rather than coerced — a null close read as 0 would look like a
 * catastrophic price move and could trigger a signal.
 */
function parse(json) {
  const chart = json && json.chart;
  if (!chart) return { ok: false, error: 'response has no chart object' };
  if (chart.error) {
    return { ok: false, error: `provider error: ${chart.error.description || chart.error.code}` };
  }

  const result = chart.result && chart.result[0];
  if (!result) return { ok: false, error: 'response contains no result' };

  const timestamps = result.timestamp;
  const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
  if (!Array.isArray(timestamps) || !quote) {
    return { ok: false, error: 'response has no timestamp or quote series' };
  }

  const bars = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const o = quote.open[i];
    const h = quote.high[i];
    const l = quote.low[i];
    const c = quote.close[i];
    const v = quote.volume[i];

    if (![o, h, l, c].every((x) => Number.isFinite(x))) continue;
    if (!Number.isFinite(v) || v <= 0) continue;

    bars.push({ t: new Date(timestamps[i] * 1000).toISOString(), o, h, l, c, v });
  }

  if (bars.length === 0) return { ok: false, error: 'no usable bars in response' };
  return { ok: true, bars };
}

async function fetchDaily(entry, { days = 400, timeoutMs } = {}) {
  const symbol = symbolFor(entry);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${rangeFor(days)}&interval=1d`;

  const response = await fetchJson(url, { timeoutMs });
  if (!response.ok) {
    return { ok: false, provider: NAME, symbol, error: response.error, status: response.status };
  }

  const parsed = parse(response.json);
  return parsed.ok
    ? { ok: true, provider: NAME, symbol, bars: parsed.bars, ms: response.ms }
    : { ok: false, provider: NAME, symbol, error: parsed.error };
}

module.exports = { name: NAME, symbolFor, rangeFor, parse, fetchDaily, supports: () => true };
