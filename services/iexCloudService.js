const axios = require('axios');
const logger = require('../utils/logger');

const IEX_BASE = 'https://sandbox.iexapis.com/stable/stock';
const TOKEN = process.env.IEX_CLOUD_SANDBOX_TOKEN;

/**
 * Fetch price from IEX Cloud sandbox.
 * Returns an object compatible with other price providers or null on failure.
 */
async function fetchIexPrice(symbol, retryCount = 0) {
  const url = `${IEX_BASE}/${encodeURIComponent(symbol)}/quote?token=${TOKEN}`;
  try {
    const { data } = await axios.get(url, { timeout: 15000 });
    if (!data || typeof data.latestPrice !== 'number') return null;
    const close = data.latestPrice;
    const previousClose = data.previousClose ?? close;
    return {
      symbol,
      close,
      previousClose,
      change: previousClose
        ? (((close - previousClose) / previousClose) * 100).toFixed(3)
        : '0.000',
      provider: 'IEX Cloud Sandbox',
    };
  } catch (err) {
    const status = err.response?.status;
    if (status === 429 && err.response?.headers?.['retry-after']) {
      const delay = parseInt(err.response.headers['retry-after'], 10) * 1000;
      logger.warn(`IEX rate‑limited, backing off ${delay}ms`, { symbol });
      await new Promise(r => setTimeout(r, delay));
    }
    logger.warn('IEX fetch error', { symbol, err: err.message, status });
    return null;
  }
}

module.exports = { fetchIexPrice };
