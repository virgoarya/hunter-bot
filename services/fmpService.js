const axios = require('axios');
const logger = require('../utils/logger');

const FMP_SYMBOLS = {
    "EUR/USD": "EURUSD",
    "GBP/USD": "GBPUSD",
    "USD/JPY": "USDJPY",
    "AUD/USD": "AUDUSD",
    "USD/CAD": "USDCAD",
    "XAU/USD": "XAUUSD",
    "XAG/USD": "XAGUSD",
    "NASDAQ": "IXIC",
    "VIX": "VIX",
    "OIL": "CL",
    "DXY": "DXY",
};

async function fetchFmpPrice(symbol) {
    const fmpSymbol = FMP_SYMBOLS[symbol] || symbol;
    try {
        const resp = await axios.get('https://financialmodelingprep.com/api/v3/quote-short', {
            params: { symbol: fmpSymbol, apikey: process.env.FMP_API_KEY || 'demo' },
            timeout: 10000,
        });
        const data = resp.data;
        if (!data || !Array.isArray(data) || data.length === 0) return null;
        const quote = data[0];
        const close = quote.price;
        const previousClose = quote.previousClose || close;
        if (!Number.isFinite(close)) return null;
        return {
            symbol,
            close,
            previousClose,
            change: previousClose ? (((close - previousClose) / previousClose) * 100).toFixed(3) : '0.000',
            provider: 'FMP',
        };
    } catch (e) {
        logger.warn(`FMP error for ${symbol}:`, e.message);
        return null;
    }
}

async function fetchMultiFmp(symbols) {
    const results = {};
    for (const sym of symbols) {
        const data = await fetchFmpPrice(sym);
        results[sym] = data;
    }
    return results;
}

module.exports = { fetchFmpPrice, fetchMultiFmp, fetchMulti: fetchMultiFmp };