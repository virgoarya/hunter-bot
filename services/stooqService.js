const axios = require("axios");
const logger = require('../utils/logger');

const STOOQ_SYMBOLS = {
    "EUR/USD": "eurusd",
    "GBP/USD": "gbpusd",
    "USD/JPY": "usdjpy",
    "AUD/USD": "audusd",
    "USD/CAD": "usdcad",
    "USD/CHF": "usdchf",
    "NZD/USD": "nzdusd",
    "GOLD": "gc.f",
    "XAU/USD": "xauusd",
    "SILVER": "xagusd",
    "XAG/USD": "xagusd",
    "OIL": "co1",
    "DXY": "usdy",
    "NASDAQ": "nq.f",
    "QQQ": "qqq",
    "VIX": "vix",
};

const STOOQ_ALT_SYMBOLS = {
    "EUR/USD": "eur",
    "GBP/USD": "gbp",
    "USD/JPY": "usd",
    "GOLD": "xau",
};

async function fetchStooqPrice(symbol, retryCount = 0) {
    const primarySym = STOOQ_SYMBOLS[symbol] || symbol.toLowerCase();
    const altSymbols = STOOQ_ALT_SYMBOLS[symbol] ? [STOOQ_ALT_SYMBOLS[symbol]] : [];
    const allSymbols = [primarySym, ...altSymbols];
    
    for (const stooqSym of allSymbols) {
        try {
            const url = `https://stooq.com/q/l/?s=${stooqSym}&f=sd2t2ohlcv&h&e=csv`;
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
                timeout: 15000,
            });

            if (response.status !== 200 || !response.data || response.data.includes("No data found")) {
                continue;
            }

            const lines = response.data.trim().split("\n");
            if (lines.length < 2) continue;

            const values = lines[1].split(",");
            if (values.length < 7) continue;

            const open = parseFloat(values[3]);
            const high = parseFloat(values[4]);
            const low = parseFloat(values[5]);
            const close = parseFloat(values[6]);
            const volume = parseInt(values[7]) || 0;

            if (!Number.isFinite(close) || close === 0) continue;

            return {
                symbol,
                stooqSymbol: stooqSym,
                date: values[1],
                time: values[2],
                open,
                high,
                low,
                close,
                volume,
                change: (((close - open) / open) * 100).toFixed(3),
                provider: "Stooq",
            };
        } catch (error) {
            const status = error.response?.status;
            if (status === 404 || error.code === 'ECONNABORTED' || status === 429 || status === 503) {
                continue;
            }
            logger.error(`Stooq error for ${symbol} (${stooqSym}):`, error.message || status || 'Unknown error');
        }
    }
    
return null;
}

async function fetchMultiStooq(symbols, delayMs = 300) {
    const results = {};
    for (const symbol of symbols) {
        const data = await fetchStooqPrice(symbol);
        results[symbol] = data;
        if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    return results;
}

module.exports = { fetchStooqPrice, fetchMultiStooq, fetchMulti: fetchMultiStooq, STOOQ_SYMBOLS };
