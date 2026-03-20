const axios = require("axios");
const { fetchYahooPrice } = require("./yahooFinance");
const { fetchMultiStooq } = require("./stooqService");

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

async function fetchFallbacks(symbols) {
    console.log("🔄 Using Multi-Tier Fallback for Market Prices...");

    // 1. Primary Fallback: Stooq (Up-to-date preference)
    try {
        console.log("📡 Attempting Primary Fallback: Stooq...");
        const stooqData = await fetchMultiStooq(symbols);
        const stooqResults = {};

        for (const [sym, data] of Object.entries(stooqData)) {
            if (data && Number.isFinite(data.close)) {
                stooqResults[sym] = {
                    price: data.close,
                    symbol: sym,
                    source: "Stooq",
                    time: data.time
                };
            }
        }

        if (Object.keys(stooqResults).length > 0) {
            console.log(`✅ Stooq Fallback successful (${Object.keys(stooqResults).length} symbols)`);
            return stooqResults;
        }
    } catch (err) {
        console.warn("⚠️ Stooq Fallback failed:", err.message);
    }

    // 2. Secondary Fallback: Yahoo Finance (Resilience)
    console.log("📡 Attempting Secondary Fallback: Yahoo Finance...");
    const yahooResults = {};
    for (const sym of symbols) {
        try {
            const data = await fetchYahooPrice(sym);
            if (data && Number.isFinite(data.close)) {
                yahooResults[sym] = {
                    price: data.close,
                    symbol: sym,
                    source: "Yahoo Finance",
                    change: data.change
                };
            }
        } catch (error) {
            console.error(`Yahoo fallback error for ${sym}:`, error.message);
        }
        await new Promise(r => setTimeout(r, 100));
    }

    return yahooResults;
}

async function fetchMultiPrice(symbols = DEFAULT_PAIRS, forceRefresh = false) {
    const now = Date.now();

    // 1. Cache Check
    if (!forceRefresh && priceCache.data && (now - priceCache.updatedAt < PRICE_CACHE_MS)) {
        return priceCache.data;
    }

    // 2. TwelveData Attempt (with Circuit Breaker)
    let finalResult = null;
    if (!twelveDataCooldown.active || now > twelveDataCooldown.until) {
        try {
            const apiKey = process.env.TWELVE_DATA_API_KEY;
            if (apiKey) {
                const symbolString = symbols.join(",");
                const response = await axios.get("https://api.twelvedata.com/price", {
                    params: { symbol: symbolString, apikey: apiKey },
                    timeout: 8000,
                });

                const data = response.data;

                // Handle Error / Rate Limit
                if (data.status === "error" || data.code === 429) {
                    console.warn(`⚠️ TwelveData Limit/Error: ${data.message || "Unknown error"}. Cooling down for 10 mins.`);
                    twelveDataCooldown = { active: true, until: now + 10 * 60 * 1000 };
                } else {
                    twelveDataCooldown.active = false;
                    finalResult = {};

                    // Handle single vs multi response
                    if (symbols.length === 1) {
                        const price = parseFloat(data?.price);
                        if (Number.isFinite(price)) {
                            finalResult[symbols[0]] = { price, symbol: symbols[0], source: "TwelveData" };
                        }
                    } else {
                        for (const sym of symbols) {
                            const entry = data?.[sym];
                            if (entry?.price) {
                                const price = parseFloat(entry.price);
                                if (Number.isFinite(price)) {
                                    finalResult[sym] = { price, symbol: sym, source: "TwelveData" };
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("TwelveData fetch error:", error.message);
            // If it's a DNS/Network error, don't necessarily cool down TwelveData specifically, 
            // but we'll fall back anyway.
        }
    }

    // 3. Fallback if TwelveData failed or cooled down
    if (!finalResult || Object.keys(finalResult).length === 0) {
        finalResult = await fetchFallbacks(symbols);
    }

    // 4. Update Cache
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
        const sourceMark = data.source === "TwelveData" ? "" : ` (${data.source[0] || "?"})`;
        table += `${name}: **${data.price}**${sourceMark}\n`;
    }

    return table;
}

module.exports = { fetchMultiPrice, formatPriceTable };
