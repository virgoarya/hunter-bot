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
    // Forex (Spot)
    "EUR/USD": "EURUSD=X",
    "GBP/USD": "GBPUSD=X",
    "USD/JPY": "JPY=X",
    "AUD/USD": "AUDUSD=X",
    "USD/CAD": "CADUSD=X",
    "USD/CHF": "CHFUSD=X",
    "NZD/USD": "NZDUSD=X",
    // Commodities (Futures)
    "GOLD": "GC=F",
    "XAU/USD": "GC=F",
    "SILVER": "SI=F",
    "XAG/USD": "SI=F",
    "OIL": "CL=F",
    // Indices & ETFs (Real & Proxy)
    "DXY": "DX=F",
    "UUP": "UUP",      // Bullish Dollar ETF
    "NASDAQ": "NQ=F",
    "QQQ": "QQQ",      // Nasdaq ETF
    "VIX": "^VIX",
    "VXX": "VXX",      // Volatility ETN
};

async function fetchYahooPrice(symbol) {
    const yahooSym = YAHOO_SYMBOLS[symbol] || symbol;

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=2d`;
        const response = await axios.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            timeout: 8000,
        });

        const result = response.data?.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const close = meta?.regularMarketPrice;
        const previousClose = meta?.chartPreviousClose || meta?.previousClose;

        if (!Number.isFinite(close) || close === 0) return null;

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
        console.error(
            `Yahoo Finance error for ${symbol} (${yahooSym}):`,
            error.message
        );
        return null;
    }
}

/**
 * Fetch multiple symbols from Yahoo Finance with small delay
 */
async function fetchMultiYahoo(symbols, delayMs = 200) {
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

module.exports = { fetchYahooPrice, fetchMultiYahoo, YAHOO_SYMBOLS };
