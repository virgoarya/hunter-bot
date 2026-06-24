const logger = require('../utils/logger');
const { fetchPrices } = require('./providerManager');

// Default symbol pairs to fetch (prioritized list)
const DEFAULT_PAIRS = [
    "EUR/USD",
    "GBP/USD",
    "XAU/USD",
    "NASDAQ",
    "VIX",
    "OIL",
];

// Simple in‑memory cache (60 s)
const PRICE_CACHE_MS = 60 * 1000;
let priceCache = { data: null, updatedAt: 0 };

/**
 * Fetch prices using the provider manager (Yahoo → Stooq → AlphaVantage).
 * The manager already handles fallback and circuit‑breaker logic.
 * wrapped in a timeout to avoid hanging the Discord interaction.
 */
async function fetchMultiPrice(symbols = DEFAULT_PAIRS, forceRefresh = false) {
    symbols = symbols || DEFAULT_PAIRS;
    const now = Date.now();

    // Return cached data if still fresh
    if (!forceRefresh && priceCache.data && (now - priceCache.updatedAt < PRICE_CACHE_MS)) {
        logger.debug('Returning cached prices', { ageMs: now - priceCache.updatedAt });
        return priceCache.data;
    }

    // Fetch with 15-second timeout
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Price fetch timeout')), 15000)
    );
    const result = await Promise.race([fetchPrices(symbols), timeoutPromise]).catch((e) => {
        logger.error('Price fetch failed:', e.message);
        return {};
    });

    // Cache the fresh result
    if (result && Object.keys(result).length > 0) {
        priceCache = { data: result, updatedAt: now };
    }

    // Ensure a uniform `price` field for downstream code
    if (result && typeof result === 'object') {
        for (const sym of Object.keys(result)) {
            const entry = result[sym];
            if (entry && entry.price === undefined && entry.close !== undefined) {
                entry.price = entry.close;
            }
        }
    }
    return result;
}

function formatPriceTable(prices) {
    if (!prices || Object.keys(prices).length === 0) return "Harga pasar tidak tersedia.";

    let table = "💰 **HARGA PASAR REAL-TIME**\n\n";
    const aliases = {
        "EUR/USD": "EUR/USD",
        "GBP/USD": "GBP/USD",
        "USD/JPY": "USD/JPY",
        "AUD/USD": "AUD/USD",
        "USD/CAD": "USD/CAD",
        "XAU/USD": "🥇 GOLD",
        "XAG/USD": "🥈 SILVER",
        DXY: "💵 DXY Index",
        NASDAQ: "📊 NASDAQ 100",
        VIX: "📉 VIX Index",
        OIL: "🛢️ CRUDE OIL",
    };
    for (const [sym, data] of Object.entries(prices)) {
        const name = aliases[sym] || sym;
        const sourceMark = data.source === 'TwelveData' ? '' : ` (${data.source[0] || '?'})`;
        table += `${name}: **${data.price}**${sourceMark}\n`;
    }
    return table;
}

module.exports = { fetchMultiPrice, formatPriceTable };
