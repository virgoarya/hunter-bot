const { fetchFinnhubPrice } = require('./finnhub');
// TwelveData support removed in favor of Stooq (no API key needed)
const { fetchStooqPrice } = require('./stooqService');
const logger = require('../utils/logger');

// Circuit breaker tracks failures per provider
const circuit = {
  finnhub: { failures: 0, lastFail: 0 },
  stooq: { failures: 0, lastFail: 0 },
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
 *   1️⃣ Finnhub (free tier)
 *   2️⃣ Stooq (free, no API key required)
 *
 * Returns an object compatible with existing callers:
 *   { symbol, close, previousClose, change, provider }
 * or `null` if all providers fail.
 */
async function fetchPrice(symbol) {
  // Try Finnhub first
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

  // Fall back to Stooq
  if (!shouldSkip('stooq')) {
    const data = await fetchStooqPrice(symbol);
    if (data) {
      resetFailure('stooq');
      return {
        symbol,
        close: data.close,
        previousClose: data.open,
        change: data.change,
        provider: 'Stooq',
      };
    }
    recordFailure('stooq');
  } else {
    logger.warn(`Skipping Stooq for ${symbol} due to circuit‑breaker`);
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
