const { fetchFinnhubPrice } = require('./finnhub');
const { fetchTwelveDataPrice } = require('./twelveData');
const logger = require('../utils/logger');

/**
 * Simple in‑memory circuit‑breaker state. Tracks consecutive failures per provider.
 * On 3 failures within a 5‑minute window the provider is skipped for subsequent calls.
 */
const circuit = {
  twelveData: { failures: 0, lastFail: 0 },
  finnhub: { failures: 0, lastFail: 0 },
};

function shouldSkip(provider) {
  const entry = circuit[provider];
  if (!entry) return false;
  // Skip if 3+ failures and last failure < 5 min ago
  return entry.failures >= 3 && Date.now() - entry.lastFail < 5 * 60 * 1000;
}

function recordFailure(provider) {
  const entry = circuit[provider];
  entry.failures++;
  entry.lastFail = Date.now();
}

function resetFailure(provider) {
  const entry = circuit[provider];
  entry.failures = 0;
  entry.lastFail = 0;
}

/**
 * Unified price fetcher that attempts providers in order:
 *   1️⃣ TwelveData (free tier)
 *   2️⃣ Finnhub (free tier)
 *
 * Returns an object compatible with existing callers:
 *   { symbol, close, previousClose, change, provider }
 * or `null` if all providers fail.
 */
async function fetchPrice(symbol) {
  // 1️⃣ TwelveData
  if (!shouldSkip('twelveData')) {
    const data = await fetchTwelveDataPrice(symbol);
    if (data) {
      resetFailure('twelveData');
      return data;
    }
    recordFailure('twelveData');
  } else {
    logger.warn(`Skipping TwelveData for ${symbol} due to circuit‑breaker`);
  }

  // 2️⃣ Finnhub
  if (!shouldSkip('finnhub')) {
    const data = await fetchFinnhubPrice(symbol);
    if (data) {
      resetFailure('finnhub');
      return data;
    }
    recordFailure('finnhub');
  } else {
    logger.warn(`Skipping Finnhub for ${symbol} due to circuit‑breaker`);
  }

  logger.warn(`All price providers failed for ${symbol}`);
  return null;
}

/**
 * Custom error type that callers can catch if they need explicit failure handling.
 */
class ProviderUnavailableError extends Error {
  constructor(symbol) {
    super(`All price providers unavailable for ${symbol}`);
    this.name = 'ProviderUnavailableError';
    this.symbol = symbol;
  }
}

module.exports = { fetchPrice, ProviderUnavailableError };
