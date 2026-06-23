const logger = require('../utils/logger');
const { fetchPrices } = require('./providerManager');

// Circuit Breaker for TwelveData (if hit limit, skip for 10 mins)
let twelveDataCooldown = { active: false, until: 0 };

const DEFAULT_PAIRS = [
    "EUR/USD",
    "GBP/USD",
    "USD/JPY",
    "AUD/USD",
    "USD/CAD",
    "XAU/USD",
    "XAG/USD",
    "DXY",
    "NASDAQ",
    "VIX",
    "OIL",
];

const PRICE_CACHE_MS = 60 * 1000; // 60 seconds
let priceCache = { data: null, updatedAt: 0 };

/**
 * Fallback to TwelveData (primary) then provider manager (secondary).
 * Provider manager already handles ordered fallback (Yahoo → Stooq → AlphaVantage).
 */
async function fetchMultiPrice(symbols = DEFAULT_PAIRS, forceRefresh = false) {
    const now = Date.now();

    // 1️⃣ Cache check
    if (!forceRefresh && priceCache.data && (now - priceCache.updatedAt < PRICE_CACHE_MS)) {
        logger.debug('Returning cached prices', { ageMs: now - priceCache.updatedAt });
        return priceCache.data;
    }

    // 2️⃣ Attempt TwelveData (primary source) unless on cooldown
    let finalResult = null;
    if (!twelveDataCooldown.active || now > twelveDataCooldown.until) {
        try {
            const apiKey = process.env.TWELVE_DATA_API_KEY;
            if (apiKey) {
                const symbolString = symbols.join(',');
                const response = await require('axios').get('https://api.twelvedata.com/price', {
                    params: { symbol: symbolString, apikey: apiKey },
                    timeout: 8000,
                });
                const data = response.data;

                // Rate‑limit / error handling
                if (data.status === 'error' || data.code === 429) {
                    logger.warn('TwelveData limit/error, entering cooldown', { message: data.message });
                    twelveDataCooldown = { active: true, until: now + 10 * 60 * 1000 };
                } else {
                    twelveDataCooldown.active = false;
                    logger.info('TwelveData fetch successful', { symbolsCount: symbols.length });
                    finalResult = {};
                    if (symbols.length === 1) {
                        const price = parseFloat(data?.price);
                        if (Number.isFinite(price)) {
                            finalResult[symbols[0]] = { price, symbol: symbols[0], source: 'TwelveData' };
                        }
                    } else {
                        for (const sym of symbols) {
                            const entry = data?.[sym];
                            if (entry?.price) {
                                const price = parseFloat(entry.price);
                                if (Number.isFinite(price)) {
                                    finalResult[sym] = { price, symbol: sym, source: 'TwelveData' };
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('TwelveData fetch error', { error: error.message });
        }
    }

    // 3️⃣ If TwelveData gave nothing, fall back to provider manager (Yahoo → Stooq → AlphaVantage)
    if (!finalResult || Object.keys(finalResult).length === 0) {
        logger.info('Falling back to multi‑provider manager');
        const fallback = await fetchPrices(symbols);
        finalResult = fallback;
    }

    // 4️⃣ Cache the result
    if (finalResult && Object.keys(finalResult).length > 0) {
        priceCache = { data: finalResult, updatedAt: now };
    }

    return finalResult;
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
