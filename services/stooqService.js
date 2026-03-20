const axios = require("axios");

/**
 * Centralized Stooq price fetcher using the CSV endpoint.
 * This is more reliable than HTML scraping (no bot protection).
 *
 * Stooq CSV endpoint: /q/l/?s=SYMBOL&f=sd2t2ohlcv&h&e=csv
 * Returns: Symbol,Date,Time,Open,High,Low,Close,Volume
 */

const STOOQ_SYMBOLS = {
    // Forex
    "EUR/USD": "eurusd",
    "GBP/USD": "gbpusd",
    "USD/JPY": "usdjpy",
    "AUD/USD": "audusd",
    "USD/CAD": "usdcad",
    "USD/CHF": "usdchf",
    "NZD/USD": "nzdusd",
    // Commodities
    "GOLD": "xauusd",
    "XAU/USD": "xauusd",
    "SILVER": "ag.f",
    "XAG/USD": "ag.f",
    "OIL": "cl.f",
    // Indices & ETFs
    "DXY": "dx.f",
    "UUP": "uup.us",
    "NASDAQ": "nq.f",
    "QQQ": "qqq.us",
    "VIX": "vi.f",
    "VXX": "vxx.us",
};

async function fetchStooqPrice(symbol) {
    const stooqSym = STOOQ_SYMBOLS[symbol] || symbol.toLowerCase();

    try {
        const url = `https://stooq.com/q/l/?s=${stooqSym}&f=sd2t2ohlcv&h&e=csv`;
        const response = await axios.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            timeout: 8000,
        });

        const lines = response.data.trim().split("\n");
        if (lines.length < 2) return null;

        // Parse CSV: Symbol,Date,Time,Open,High,Low,Close,Volume
        const values = lines[1].split(",");
        if (values.length < 7) return null;

        const open = parseFloat(values[3]);
        const high = parseFloat(values[4]);
        const low = parseFloat(values[5]);
        const close = parseFloat(values[6]);
        const volume = parseInt(values[7]) || 0;

        if (!Number.isFinite(close) || close === 0) return null;

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
        console.error(`Stooq CSV error for ${symbol} (${stooqSym}):`, error.message);
        return null;
    }
}

/**
 * Fetch multiple symbols from Stooq with delay between requests
 */
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

module.exports = { fetchStooqPrice, fetchMultiStooq, STOOQ_SYMBOLS };
