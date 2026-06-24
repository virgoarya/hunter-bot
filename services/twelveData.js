const axios = require('axios');
const logger = require('../utils/logger');

/**
 * TwelveData price fetcher (free tier).
 * Returns an object compatible with existing callers:
 *   { symbol, close, previousClose, change, provider: 'TwelveData' }
 * Handles both forex (e.g., EUR/USD) and commodity/index symbols.
 */
// Mapping symbols to TwelveData expected tickers
const TWELVE_SYMBOLS = {
  "EUR/USD": "EURUSD",
  "GBP/USD": "GBPUSD",
  "USD/JPY": "USDJPY",
  "AUD/USD": "AUDUSD",
  "USD/CAD": "USDCAD",
  "USD/CHF": "USDCHF",
  "NZD/USD": "NZDUSD",
  "GOLD": "XAUUSD", // Gold spot
  "XAU/USD": "XAUUSD",
  "SILVER": "XAGUSD",
  "XAG/USD": "XAGUSD",
  "OIL": "OIL", // Crude Oil future (works as OIL)
  "DXY": "DXY",
  "NASDAQ": "IXIC", // Nasdaq Composite
  "VIX": "VIX",
  // Add more mappings as needed
};

async function fetchTwelveDataPrice(symbol) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    logger.error('TwelveData API key not set (TWELVE_DATA_API_KEY)');
    return null;
  }
  try {
    const tdSymbol = TWELVE_SYMBOLS[symbol] || symbol;
    const resp = await axios.get('https://api.twelvedata.com/time_series', {
      params: { symbol: tdSymbol, interval: '1min', apikey: apiKey },
      timeout: 10000,
    });
    const data = resp.data;
    if (!data || data.status === 'error' || !data.values || !data.values.length) {
      logger.warn(`TwelveData no data for ${symbol}`);
      return null;
    }
    const latest = data.values[0];
    const close = parseFloat(latest.close);
    const previousClose = parseFloat(latest.prev_close) || close;
    const change = previousClose ? (((close - previousClose) / previousClose) * 100).toFixed(3) : '0.000';
    return { symbol, close, previousClose, change, provider: 'TwelveData' };
  } catch (e) {
    const status = e.response?.status;
    if (status === 429) {
      logger.warn(`TwelveData rate limit hit for ${symbol}`);
    } else {
      logger.error(`TwelveData fetch error for ${symbol}: ${e.message}`);
    }
    return null;
  }
}

module.exports = { fetchTwelveDataPrice };
