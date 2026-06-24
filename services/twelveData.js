const axios = require('axios');
const logger = require('../utils/logger');

/**
 * TwelveData price fetcher (free tier).
 * Returns an object compatible with existing callers:
 *   { symbol, close, previousClose, change, provider: 'TwelveData' }
 * Handles both forex (e.g., EUR/USD) and commodity/index symbols.
 */
async function fetchTwelveDataPrice(symbol) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    logger.error('TwelveData API key not set (TWELVE_DATA_API_KEY)');
    return null;
  }
  try {
    const resp = await axios.get('https://api.twelvedata.com/time_series', {
      params: { symbol, interval: '1min', apikey: apiKey },
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
