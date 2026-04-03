const { fetchMarketBullCOT } = require("./marketBullScraper");

// Contract names to track (partial match in CFTC report)
const TRACKED_CONTRACTS = [
    { search: "EURO FX", alias: "EUR/USD", category: "forex", marketBullKey: "eur" },
    { search: "BRITISH POUND", alias: "GBP/USD", category: "forex", marketBullKey: "gbp" },
    { search: "JAPANESE YEN", alias: "USD/JPY", category: "forex", marketBullKey: "jpy" },
    { search: "AUSTRALIAN DOLLAR", alias: "AUD/USD", category: "forex", marketBullKey: "aud" },
    { search: "CANADIAN DOLLAR", alias: "USD/CAD", category: "forex", marketBullKey: "cad" },
    { search: "SWISS FRANC", alias: "USD/CHF", category: "forex", marketBullKey: "chf" },
    { search: "GOLD", alias: "GOLD", category: "commodity", marketBullKey: "gold" },
    { search: "SILVER", alias: "SILVER", category: "commodity" },
    { search: "CRUDE OIL", alias: "OIL", category: "commodity" },
    { search: "E-MINI S&P 500", alias: "S&P 500", category: "index", marketBullKey: "sp500" },
    { search: "NASDAQ-100", alias: "NASDAQ", category: "index", marketBullKey: "nasdaq" },
    { search: "U.S. DOLLAR INDEX", alias: "USD Index", category: "index", marketBullKey: "usd" },
];

async function fetchCOTData(forceRefresh = false) {
    // Always fetch fresh from MarketBull (no CFTC dependency)
    try {
        const results = [];

        for (const tracked of TRACKED_CONTRACTS) {
            // Initialize contract with defaults
            const contract = {
                name: tracked.alias,
                category: tracked.category,
                openInterest: 0, // MarketBull doesn't provide this
                speculator: { long: 0, short: 0, net: 0 },
                commercial: { long: 0, short: 0, net: 0 },
                sentiment: "N/A",
                marketBull: null
            };

            // Fetch MarketBull data only (primary source)
            if (tracked.marketBullKey) {
                try {
                    const mbData = await fetchMarketBullCOT(tracked.marketBullKey);
                    if (mbData) {
                        contract.marketBull = mbData;

                        // Parse net position from MarketBull string (e.g., "+1234" or "-567")
                        const netPosStr = mbData.netPosition;
                        if (netPosStr && netPosStr !== "N/A") {
                            const net = parseInt(netPosStr.replace(/[^\d-]/g, '')) || 0;
                            contract.speculator.net = net;
                            contract.sentiment = net > 0 ? "BULLISH" : net < 0 ? "BEARISH" : "NETRAL";
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ MarketBull fetch failed for ${tracked.alias}:`, err.message);
                }
            }

            results.push(contract);
        }

        return {
            contracts: results,
            reportDate: new Date().toISOString().split('T')[0], // Approximate date
            fetchedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error("COT Data fetch error:", error.message);
        return null;
    }
}


function formatCOTReport(cotData) {
    if (!cotData || !cotData.contracts?.length) {
        return "📊 Data COT tidak tersedia saat ini.";
    }

    let report = `📊 **LAPORAN COMMITMENT OF TRADERS**\n`;
    report += `📅 Tanggal Laporan: ${cotData.reportDate}\n\n`;

    const categories = {
        forex: { title: "💱 **FOREX**", items: [] },
        commodity: { title: "🏆 **KOMODITAS**", items: [] },
        index: { title: "📈 **INDEKS**", items: [] },
    };

    for (const contract of cotData.contracts) {
        const arrow =
            contract.sentiment === "BULLISH"
                ? "🟢"
                : contract.sentiment === "BEARISH"
                    ? "🔴"
                    : "⚪";
        const netFormatted =
            contract.speculator.net > 0
                ? `+${contract.speculator.net.toLocaleString()}`
                : contract.speculator.net.toLocaleString();

        let line = `${arrow} **${contract.name}** — Speculators: ${netFormatted} | Comm: ${contract.commercial.net > 0 ? "+" : ""}${contract.commercial.net.toLocaleString()}`;

        // Append MarketBull Insights if available
        if (contract.marketBull && contract.marketBull.cotIndex6M !== "N/A") {
            line += `\n   ┗ 📊 **COT Index (6M): ${contract.marketBull.cotIndex6M}** | [View Chart](${contract.marketBull.chartUrl})`;
        }

        if (categories[contract.category]) {
            categories[contract.category].items.push(line);
        }
    }

    for (const cat of Object.values(categories)) {
        if (cat.items.length > 0) {
            report += `${cat.title}\n`;
            report += cat.items.join("\n") + "\n\n";
        }
    }

    return report;
}

module.exports = { fetchCOTData, formatCOTReport };
