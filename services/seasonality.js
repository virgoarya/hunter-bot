/**
 * Seasonality Tendencies based on MarketBull (market-bulls.com) 20-Year Heatmap.
 * This aligns the bot's cyclical intelligence with the user's preferred source.
 */

const SEASONAL_MAP = {
    // Month is 0-indexed (Jan = 0, Dec = 11)
    0: { // January
        usd: "Bullish",
        gold: "Strong Bullish", // MB Score: +28.8
        equity: "Bullish",
        note: "MarketBulls: Gold Jan Rally (+28.8) & US Dollar Strength"
    },
    1: { // February
        usd: "Bullish",
        gold: "Bullish",
        equity: "Neutral",
        note: "MarketBulls: Kelanjutan momentum awal tahun"
    },
    2: { // March
        usd: "Neutral",
        gold: "Bearish", // MB Score: -6.8
        equity: "Neutral",
        note: "MarketBulls: Koreksi musiman pada Emas"
    },
    3: { // April
        usd: "Bearish", // USD Weakness in April
        gold: "Bullish",
        equity: "Strong Bullish", // MB Score: +49.2 (Bulan terbaik S&P 500)
        note: "MarketBulls: April Spring Rally (+49.2) & USD Weakness"
    },
    4: { // May
        usd: "Neutral",
        gold: "Neutral",
        equity: "Bearish",
        note: "MarketBulls: Transisi 'Sell in May' dimonitor"
    },
    5: { // June
        usd: "Neutral",
        gold: "Bearish", // MB Score: -6.2
        equity: "Neutral",
        note: "MarketBulls: Summer doldrums pada Emas"
    },
    6: { // July
        usd: "Bearish",
        gold: "Bullish",
        equity: "Bullish", // MB Score: +33.3
        note: "MarketBulls: Summer Rally pada Saham (+33.3)"
    },
    7: { // August
        usd: "Bullish",
        gold: "Strong Bullish", // MB Score: +25.1
        equity: "Bearish",
        note: "MarketBulls: Gold August Peak (+25.1) & Volatilitas Saham"
    },
    8: { // September
        usd: "Bullish",
        gold: "Strong Bearish", // MB Score: -11.9
        equity: "Strong Bearish", // MB Score: -18.0 (Bulan terburuk S&P 500)
        note: "MarketBulls: September Slump (Bulan terburuk Saham & Emas)"
    },
    9: { // October
        usd: "Neutral",
        gold: "Neutral",
        equity: "Bullish",
        note: "MarketBulls: Bottoming out & persiapan Q4 rally"
    },
    10: { // November
        usd: "Bullish",
        gold: "Neutral",
        equity: "Strong Bullish", // MB Score: +42.3
        note: "MarketBulls: November Surge (+42.3) & USD Strength"
    },
    11: { // December
        usd: "Strong Bearish", // USD Weakness
        gold: "Bullish",
        equity: "Strong Bullish",
        note: "MarketBulls: Santa Claus Rally & USD Year-End Weakness"
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
