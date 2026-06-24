const logger = require('../utils/logger');
const axios = require("axios");

/**
 * Centralized Yahoo Finance price fetcher
 * Uses the free /v8/finance/chart/ endpoint — no API key required
 * Returns real futures & index prices (not ETF proxies)
 *
 * Symbol mapping:
 *   DXY     → DX=F  (US Dollar Index Futures)
 *   GOLD    → GC=F  (Gold Futures)
 *   NASDAQ  → NQ=F  (Nasdaq 100 Futures)
 *   VIX     → ^VIX  (CBOE Volatility Index)
 *   EUR/USD → EURUSD=X
 *   GBP/USD → GBPUSD=X
 *   USD/JPY → JPY=X
 *   AUD/USD → AUDUSD=X
 *   XAU/USD → GC=F  (alias for Gold)
 */

const YAHOO_SYMBOLS = {
    "EUR/USD": "EURUSD=X",
    "GBP/USD": "GBPUSD=X",
    "USD/JPY": "USDJPY=X",
    "AUD/USD": "AUDUSD=X",
    "USD/CAD": "USDCAD=X",
    "USD/CHF": "USDCHF=X",
    "NZD/USD": "NZDUSD=X",
    "GOLD": "GC=F",
    "XAU/USD": "GC=F",
    "SILVER": "SI=F",
    "XAG/USD": "SI=F",
    "OIL": "CL=F",
    "DXY": "DX=F",
    "UUP": "UUP",
    "NASDAQ": "NQ=F",
    "QQQ": "QQQ",
    "VIX": "^VIX",
    "VXX": "VXX",
};

const YAHOO_ALT_SYMBOLS = {
    "DXY": ["^DXY", "DX=F"],
    "NASDAQ": ["NQ=F", "^IXIC"],
    "VIX": ["^VIX"],
    "EUR/USD": ["EURUSD=X"],
    "GBP/USD": ["GBPUSD=X"],
    "USD/JPY": ["USDJPY=X"],
    "GOLD": ["GC=F", "XAU=F"],
};

const YAHOO_RETRY_SYMBOLS = {};

async function fetchYahooPrice(symbol, retryCount = 0) {
    const primarySym = YAHOO_SYMBOLS[symbol] || symbol;
    const altSymbols = YAHOO_ALT_SYMBOLS[symbol] || [];
    const allSymbols = [primarySym, ...altSymbols];
    
    for (const yahooSym of allSymbols) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=2d`;
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
                timeout: 15000,
            });

            const result = response.data?.chart?.result?.[0];
            if (!result) continue;

            const meta = result.meta;
            const close = meta?.regularMarketPrice;
            const previousClose = meta?.chartPreviousClose || meta?.previousClose;

            if (!Number.isFinite(close) || close === 0) continue;

            return {
                symbol,
                yahooSymbol: yahooSym,
                close,
                previousClose: previousClose || close,
                change: previousClose
                    ? (((close - previousClose) / previousClose) * 100).toFixed(3)
                    : "0.000",
                provider: "Yahoo Finance",
            };
        } catch (error) {
            const status = error.response?.status;
            const errorMsg = error.message || (error.response ? `HTTP ${status}` : 'Network error');
            if (status === 404 || error.code === 'ECONNABORTED' || status === 429 || status === 503 || !error.response) {
                continue;
            }
            logger.warn(`⚠️ Yahoo Finance error for ${symbol} (${yahooSym}): ${errorMsg}`);
        }
    }
    
return null;
}

async function fetchMultiYahoo(symbols, delayMs = 500) {
    const results = {};
    for (const symbol of symbols) {
        const data = await fetchYahooPrice(symbol);
        results[symbol] = data;
        if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    return results;
}

// Export a generic fetchMulti for provider manager compatibility
async function fetchMulti(symbols, _retryCount) {
  // retryCount not used – Yahoo fetch already handles its own retries
  return fetchMultiYahoo(symbols);
}

module.exports = { fetchYahooPrice, fetchMultiYahoo, YAHOO_SYMBOLS, fetchMulti };
