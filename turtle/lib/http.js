'use strict';

/**
 * HTTP fetching with timeouts, retries and backoff.
 *
 * Uses Node's built-in fetch (Node 18+), so there are no dependencies to
 * install or keep patched on the machine this runs on.
 *
 * Every failure mode here is turned into a returned result rather than a thrown
 * exception. A provider being down is a NORMAL condition for this system, not an
 * error — the whole point of the provider layer is that one source failing must
 * never stop a run.
 */

const DEFAULT_HEADERS = {
  // Some data endpoints reject requests without a browser-like agent.
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-CA,en;q=0.9',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch a URL as text.
 *
 * Returns `{ ok, status, body, error, attempts, ms }`. Retries only on
 * conditions that a retry can plausibly fix: network errors, timeouts, 429 and
 * 5xx. A 404 is a permanent answer about that symbol and is not retried —
 * hammering a provider for a ticker it does not carry wastes the scan budget.
 */
async function fetchText(url, { timeoutMs = 12000, retries = 2, backoffMs = 400, headers } = {}) {
  const started = Date.now();
  let lastError = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { ...DEFAULT_HEADERS, ...headers },
        redirect: 'follow',
      });

      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          body: await response.text(),
          attempts: attempt,
          ms: Date.now() - started,
        };
      }

      const retryable = response.status === 429 || response.status >= 500;
      lastError = `HTTP ${response.status}`;
      if (!retryable) {
        return {
          ok: false,
          status: response.status,
          error: lastError,
          attempts: attempt,
          ms: Date.now() - started,
        };
      }
    } catch (error) {
      // Timeouts surface as AbortError; DNS and connection failures as TypeError.
      lastError = error.name === 'TimeoutError' || error.name === 'AbortError'
        ? `timeout after ${timeoutMs}ms`
        : error.message;
    }

    if (attempt <= retries) await sleep(backoffMs * Math.pow(2, attempt - 1));
  }

  return { ok: false, status: 0, error: lastError, attempts: retries + 1, ms: Date.now() - started };
}

/** Fetch and parse JSON. A body that is not JSON is a provider failure, not a crash. */
async function fetchJson(url, options) {
  const result = await fetchText(url, options);
  if (!result.ok) return result;
  try {
    return { ...result, json: JSON.parse(result.body) };
  } catch (error) {
    return { ok: false, status: result.status, error: `invalid JSON: ${error.message}`, ms: result.ms };
  }
}

/**
 * Run async tasks with bounded concurrency.
 *
 * A full-market scan is hundreds of requests. Firing them all at once gets the
 * machine rate-limited or throttled by the provider; running them serially takes
 * far too long. This keeps a fixed number in flight and never rejects — a failed
 * task resolves to its error so one bad symbol cannot abort the scan.
 */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { ok: false, error: error.message, item: items[index] };
      }
    }
  });

  await Promise.all(runners);
  return results;
}

module.exports = { fetchText, fetchJson, mapWithConcurrency, DEFAULT_HEADERS };
