const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Finnhub price fetcher (free tier).
 * Returns an object compatible with the existing callers:
 *   { symbol, close, previousClose, change, provider: 'Finnhub' }
 * For symbols not found, returns null.
 */
async function fetchFinnhubPrice(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    logger.error('Finnhub API key not set (FINNHUB_API_KEY)');
    return null;
  }
  try {
    // Finnhub uses symbol directly (e.g., AAPL, EURUSD, XAUUSD)
    const resp = await axios.get('https://finnhub.io/api/v1/quote', {
      params: { symbol, token: apiKey },
      timeout: 10000,
    });
    const data = resp.data;
    if (!data || typeof data.c !== 'number') return null;
    const close = data.c;
    const previousClose = data.pc || close;
    const change = previousClose ? (((close - previousClose) / previousClose) * 100).toFixed(3) : '0.000';
    return { symbol, close, previousClose, change, provider: 'Finnhub' };
  } catch (e) {
    const status = e.response?.status;
    if (status === 429) {
      logger.warn(`Finnhub rate limit hit for ${symbol}`);
    } else {
      logger.error(`Finnhub fetch error for ${symbol}: ${e.message}`);
    }
    return null;
  }
}

module.exports = { fetchFinnhubPrice };
