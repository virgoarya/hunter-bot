/**
 * Central price provider manager.
 * Reads order & settings from ./config/priceProviders.json and orchestras fallback.
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const cfgPath = path.resolve(__dirname, '../config/priceProviders.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

// Load provider modules (must export fetchMulti(symbols, retryCount))
const providers = {
  yahoo: require('./yahooFinance'),
  stooq: require('./stooqService'),
  alphaVantage: require('./alphaVantage'),
};
// Omit AlphaVantage if API key is missing to avoid noisy errors
if (!process.env.ALPHA_VANTAGE_KEY) {
  delete providers.alphaVantage;
}


// Circuit‑breaker state (in‑memory)
const cbState = {};
for (const name of Object.keys(providers)) {
  cbState[name] = { cooldownUntil: 0 };
}

/** Simple exponential back‑off with jitter */
async function withRetry(fn, attempts = cfg.retryCount, base = cfg.baseDelayMs) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === attempts - 1) throw e;
      const jitter = Math.random() * 500;
      const delay = base * Math.pow(2, i) + jitter;
      logger.warn('Retrying after delay', { attempt: i + 1, delay, error: e.message });
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/** Main entry – fetch prices with ordered fallback */
async function fetchPrices(symbols) {
  const merged = {};

  for (const name of cfg.order) {
    // skip if circuit‑breaker active (only if entry exists)
    if (cbState[name] && Date.now() < cbState[name].cooldownUntil) {
      logger.warn('Provider on cooldown, skipping', { provider: name });
      continue;
    }

    const provider = providers[name];
    if (!provider) {
      logger.info('Provider module not available (skipped)', { provider: name });
      continue;
    }

    try {
      // Determine which symbols still need data
      const remaining = symbols.filter(s => !(s in merged));
      if (remaining.length === 0) {
        break;
      }
      const data = await withRetry(() => provider.fetchMulti(remaining, cfg.retryCount));
      for (const [sym, info] of Object.entries(data)) {
        if (info && !(sym in merged)) {
          // Prefer explicit `price`, otherwise fall back to `close`
          const priceVal = Number.isFinite(info.price)
            ? info.price
            : Number.isFinite(info.close)
            ? info.close
            : undefined;
          if (priceVal !== undefined) {
            const mergedInfo = { ...info, source: name.charAt(0).toUpperCase() + name.slice(1) };
            mergedInfo.price = priceVal;
            merged[sym] = mergedInfo;
          }
        }
      }
      // break early if we already have all symbols
      if (Object.keys(merged).length === symbols.length) break;
    } catch (e) {
      logger.warn('Provider failed', { provider: name, error: e.message });
      // If error looks like rate‑limit or 5xx, engage cooldown
      const status = e.response?.status;
      if (status === 429 || status >= 500) {
        const cd = (cfg.circuitBreaker[name] && cfg.circuitBreaker[name].cooldownMs) || 5 * 60 * 1000;
        cbState[name].cooldownUntil = Date.now() + cd;
        logger.warn('Engaging cooldown', { provider: name, until: new Date(cbState[name].cooldownUntil).toISOString() });
      }
    }
  }

  return merged;
}

module.exports = { fetchPrices };
