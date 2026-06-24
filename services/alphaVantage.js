/**
 * AlphaVantage price fetcher (FX & Commodity).
 * Uses the free API (25 requests/day). Handles basic rate‑limit detection (429) and
 * falls back to null so the provider manager can try the next source.
 *
 * Expected symbol format: "EUR/USD", "GBP/USD", "XAU/USD", "VIX", …
 * For FX pairs we call the `FX_INTRADAY` endpoint (5‑minute interval) and take the
 * most recent close price. For commodity / index symbols we use the generic
 * `TIME_SERIES_DAILY_ADJUSTED` endpoint when supported.
 */
const axios = require('axios');
const logger = require('../utils/logger');

// Mapping for symbols that require special AlphaVantage function or ticker.
// Most FX pairs can be built from "from"/"to" parts.
const SPECIAL_TICKERS = {
  VIX: { func: 'TIME_SERIES_DAILY_ADJUSTED', symbol: '^VIX' }, // not officially supported, fallback will fail gracefully
  OIL: { func: 'TIME_SERIES_DAILY_ADJUSTED', symbol: 'CL=F' },
  GOLD: { func: 'TIME_SERIES_DAILY_ADJUSTED', symbol: 'GC=F' },
  XAU: { func: 'TIME_SERIES_DAILY_ADJUSTED', symbol: 'GC=F' },
};

/**
 * Parse a generic pair like "EUR/USD" into {from, to}.
 */
function parsePair(sym) {
  const parts = sym.split('/');
  if (parts.length === 2) {
    return { from: parts[0].toUpperCase(), to: parts[1].toUpperCase() };
  }
  // fallback – treat whole string as ticker
  return null;
}

/**
 * Fetch a single price from AlphaVantage.
 * Returns null on any non‑recoverable error (rate limit, unknown symbol, etc.).
 */
async function fetchAlphaPrice(symbol) {
  const apiKey = process.env.ALPHA_VANTAGE_KEY || process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    logger.error('AlphaVantage API key not set (ALPHA_VANTAGE_KEY)');
    return null;
  }

  // 1️⃣ Try FX intraday for standard pairs
  const pair = parsePair(symbol);
  if (pair) {
    const url = 'https://www.alphavantage.co/query';
    const params = {
      function: 'FX_INTRADAY',
      from_symbol: pair.from,
      to_symbol: pair.to,
      interval: '5min',
      outputsize: 'compact',
      apikey: apiKey,
    };
    try {
      const resp = await axios.get(url, { params, timeout: 15000 });
      const data = resp.data;
      if (data['Error Message'] || data['Note']) {
        // Note usually means rate‑limit hit.
        logger.warn('AlphaVantage limit or error for FX', { symbol, data });
        return null;
      }
      const series = data['Time Series FX (5min)'];
      if (!series) return null;
      // Grab the most recent entry (object keys are ISO timestamps, descending order not guaranteed)
      const latestKey = Object.keys(series).sort().reverse()[0];
      const latest = series[latestKey];
      const price = parseFloat(latest['4. close']);
      if (!Number.isFinite(price)) return null;
      return {
        symbol,
        price,
        time: latestKey,
        source: 'AlphaVantage',
      };
    } catch (e) {
      const status = e.response?.status;
      if (status === 429) {
        logger.warn('AlphaVantage rate‑limit (429) for FX', { symbol });
        return null;
      }
      logger.error('AlphaVantage fetch error (FX)', { symbol, err: e.message });
      return null;
    }
  }

  // 2️⃣ Special tickers (e.g., GOLD, OIL) – use TIME_SERIES_DAILY_ADJUSTED
  const spec = SPECIAL_TICKERS[symbol];
  if (!spec) return null;
  const url = 'https://www.alphavantage.co/query';
  const params = {
    function: spec.func,
    symbol: spec.symbol,
    apikey: apiKey,
    outputsize: 'compact',
  };
  try {
    const resp = await axios.get(url, { params, timeout: 15000 });
    const data = resp.data;
    if (data['Error Message'] || data['Note']) {
      logger.warn('AlphaVantage limit/error for special ticker', { symbol, data });
      return null;
    }
    const series = data['Time Series (Daily)'] || data['Time Series (Daily)'];
    if (!series) return null;
    const latestKey = Object.keys(series).sort().reverse()[0];
    const latest = series[latestKey];
    const price = parseFloat(latest['4. close']);
    if (!Number.isFinite(price)) return null;
    return {
      symbol,
      price,
      time: latestKey,
      source: 'AlphaVantage',
    };
  } catch (e) {
    const status = e.response?.status;
    if (status === 429) {
      logger.warn('AlphaVantage rate‑limit (429) for special ticker', { symbol });
      return null;
    }
    logger.error('AlphaVantage fetch error (special)', { symbol, err: e.message });
    return null;
  }
}

/**
 * Batch fetch – respects the free‑tier daily limit (25 calls).
 * We simply iterate sequentially; the provider manager will call this only when
 * other providers have failed, keeping usage low.
 */
async function fetchMulti(symbols) {
  const results = {};
  for (const sym of symbols) {
    const data = await fetchAlphaPrice(sym);
    results[sym] = data;
    // Small delay to be nice to the API (avoid hitting per‑second quota)
    await new Promise(r => setTimeout(r, 200));
  }
  return results;
}

module.exports = { fetchMulti };
