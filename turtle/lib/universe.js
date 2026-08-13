'use strict';

/**
 * Universe resolution: turning a ticker into a verified IBKR contract.
 *
 * A search for "CSU" returns eighteen stock rows across a dozen exchanges,
 * including `CSUU` (a 2x leveraged Constellation ETF) and `CSUC` (a covered-call
 * fund on the same underlying) both listed on the TSE. Picking the wrong row
 * means every subsequent price, ATR and breakout level in this system belongs to
 * a different instrument than the one being traded.
 *
 * Resolution is therefore exact-match and fail-closed: anything ambiguous is
 * rejected for manual review rather than guessed at.
 */

/**
 * Products whose price series does not represent the underlying business.
 * Leveraged and derivative-income wrappers trend differently from their
 * underlying and would corrupt both the backtest and live signals.
 */
const EXCLUDED_DESCRIPTION_PATTERNS = [
  /\b\d+X\b/i,
  /\b(BULL|BEAR|INVERSE|LEVERAGED)\b/i,
  /\bCOVERED CALL\b/i,
  /\b(HIGH INCOME|ENHANCED|YIELD SHARES|INCOME SHARES|CORESH|HISHR)\b/i,
  /\bETF\b/i,
  /\bINDEX\b/i,
];

/** ETFs we intentionally allow through — currently only the regime benchmark. */
const ALLOWED_ETFS = new Set(['XIC']);

function isExcludedProduct(symbol, description) {
  if (ALLOWED_ETFS.has(symbol)) return null;
  for (const pattern of EXCLUDED_DESCRIPTION_PATTERNS) {
    if (pattern.test(description || '')) {
      return `description "${description}" matches excluded product pattern ${pattern}`;
    }
  }
  return null;
}

/**
 * Select the TSX row for `symbol` from a `search_contracts` response.
 *
 * Returns `{ ok: true, contract }` or `{ ok: false, reason }`. Never throws and
 * never returns a best guess.
 */
function selectTseRow(symbol, searchResponse) {
  const results = (searchResponse && searchResponse.results) || [];
  if (results.length === 0) {
    return { ok: false, symbol, reason: 'search returned no results' };
  }

  const matches = results.filter(
    (row) =>
      row.exchange === 'TSE' &&
      row.country_code === 'CA' &&
      row.symbol === symbol &&
      Array.isArray(row.sections) &&
      row.sections.some((s) => s.security_type === 'STK') &&
      Number.isFinite(row.underlying_contract_id)
  );

  if (matches.length === 0) {
    const near = results
      .filter((row) => row.exchange === 'TSE')
      .map((row) => row.symbol)
      .slice(0, 5);
    return {
      ok: false,
      symbol,
      reason: near.length
        ? `no exact TSE match; TSE rows present were ${near.join(', ')}`
        : 'no TSE-listed Canadian stock row found',
    };
  }

  // Two exact TSE matches for one ticker should be impossible. If it happens the
  // data has changed shape and a human needs to look, not a heuristic.
  if (matches.length > 1) {
    return {
      ok: false,
      symbol,
      reason: `ambiguous: ${matches.length} exact TSE matches (contract ids ${matches
        .map((m) => m.underlying_contract_id)
        .join(', ')})`,
    };
  }

  const row = matches[0];
  const excluded = isExcludedProduct(symbol, row.description);
  if (excluded) return { ok: false, symbol, reason: excluded };

  return {
    ok: true,
    contract: {
      symbol,
      contractId: row.underlying_contract_id,
      description: row.description,
      exchange: row.exchange,
      currency: 'CAD',
    },
  };
}

/**
 * Liquidity and tradeability screen, applied once a snapshot is available.
 *
 * The share-price ceiling is not cosmetic: a $3,000 stock with a $130 ATR risks
 * $260 on a single share against a $75 per-unit budget, so it can never be
 * sized. Screening it out here keeps it from consuming a data-fetch slot every
 * single day.
 */
function screenTradeable(entry, snapshot, config) {
  const failures = [];
  const cfg = config.universe;

  const price = snapshot && snapshot.last && Number.isFinite(snapshot.last.price)
    ? snapshot.last.price
    : null;
  const dollarVolume =
    snapshot && snapshot['avg-90d-usd-volume']
      ? snapshot['avg-90d-usd-volume'].volume
      : null;

  if (price === null) {
    failures.push('no last price available');
  } else if (price > cfg.maxSharePrice) {
    failures.push(`share price $${price.toFixed(2)} exceeds the $${cfg.maxSharePrice} ceiling`);
  }

  if (dollarVolume === null) {
    failures.push('no 90-day volume statistic available');
  } else if (dollarVolume < cfg.minAvgDailyValue) {
    failures.push(
      `90-day average value $${Math.round(dollarVolume).toLocaleString()} is below the $${cfg.minAvgDailyValue.toLocaleString()} liquidity floor`
    );
  }

  return { ...entry, price, dollarVolume, tradeable: failures.length === 0, failures };
}

/**
 * Assemble the universe file from resolution results.
 * Rejected tickers are retained with their reason so the list is auditable
 * rather than silently shorter than the candidate list that produced it.
 */
function buildUniverse(resolutions, { verifiedAt }) {
  const resolved = [];
  const rejected = [];

  for (const item of resolutions) {
    if (item.result.ok) {
      resolved.push({
        ...item.result.contract,
        name: item.name,
        sector: item.sector,
      });
    } else {
      rejected.push({
        symbol: item.symbol,
        name: item.name,
        sector: item.sector,
        reason: item.result.reason,
      });
    }
  }

  resolved.sort((a, b) => a.symbol.localeCompare(b.symbol));

  const bySector = {};
  for (const entry of resolved) {
    bySector[entry.sector] = (bySector[entry.sector] || 0) + 1;
  }

  return {
    verifiedAt,
    exchange: 'TSE',
    currency: 'CAD',
    counts: { resolved: resolved.length, rejected: rejected.length, bySector },
    symbols: resolved,
    rejected,
  };
}

module.exports = {
  EXCLUDED_DESCRIPTION_PATTERNS,
  selectTseRow,
  screenTradeable,
  buildUniverse,
};
