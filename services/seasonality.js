/**
 * Historical Seasonality Tendencies (based on 20+ years of data)
 * This provides a "cyclical tilt" to the real-time macro analysis.
 */

const SEASONAL_MAP = {
    // Month is 0-indexed (Jan = 0, Dec = 11)
    0: { // January
        usd: "Bullish", // New year capital flow
        gold: "Strong Bullish", // Historical strongest month
        equity: "Bullish", // January Effect
        note: "January Effect & Strong Gold Seasonality"
    },
    1: { // February
        usd: "Bullish", 
        gold: "Bullish",
        equity: "Neutral",
        note: "USD tends to maintain early-year strength"
    },
    2: { // March
        usd: "Neutral",
        gold: "Bearish", // Historically weak for gold
        equity: "Bullish",
        note: "Equities often rally ahead of Q1 close"
    },
    3: { // April
        usd: "Bearish", // Tax season / USD softening
        gold: "Neutral",
        equity: "Strong Bullish", // Historically one of the best months
        note: "Strong Equity Seasonality (Post-Tax)"
    },
    4: { // May
        usd: "Bullish", // "Sell in May" often leads to USD safety
        gold: "Neutral",
        equity: "Bearish", // "Sell in May and go away"
        note: "Sell in May & USD Safe Haven Tendency"
    },
    5: { // June
        usd: "Neutral",
        gold: "Neutral",
        equity: "Neutral",
        note: "Market often enters summer consolidation"
    },
    6: { // July
        usd: "Bearish", 
        gold: "Neutral",
        equity: "Bullish", // Summer rally tendency
        note: "Summer Equity Strength"
    },
    7: { // August
        usd: "Bullish", 
        gold: "Bullish", // Gold begins fall rally
        equity: "Bearish", // Low liquidity, high volatility
        note: "Low Liquidity & Gold Fall Rally Start"
    },
    8: { // September
        usd: "Bullish", 
        gold: "Bullish",
        equity: "Strong Bearish", // Historically the worst month for stocks
        note: "September Slump (Historically Worst for Stocks)"
    },
    9: { // October
        usd: "Neutral", 
        gold: "Neutral",
        equity: "Bullish", // "Bear killer" month
        note: "October Volatility & Bottoming Tendency"
    },
    10: { // November
        usd: "Neutral", 
        gold: "Neutral",
        equity: "Bullish", // Start of year-end rally
        note: "Year-End Rally Inception"
    },
    11: { // December
        usd: "Bearish", // Year-end dollar selling
        gold: "Bullish", // Pre-January positioning
        equity: "Strong Bullish", // Santa Claus Rally
        note: "Santa Claus Rally & Year-End USD Weakness"
    }
};

function getSeasonalTendency(month = new Date().getMonth()) {
    return SEASONAL_MAP[month] || {
        usd: "Neutral",
        gold: "Neutral",
        equity: "Neutral",
        note: ""
    };
}

module.exports = { getSeasonalTendency };
