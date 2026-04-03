const fs = require("fs");
const path = require("path");
const { fetchMarketBullCOT } = require("./marketBullScraper");

// Contract names to track (map to CFTC report search strings and MarketBull keys)
const TRACKED_CONTRACTS = [
    { search: "EURO FX", alias: "EUR/USD", category: "forex", marketBullKey: "eur" },
    { search: "BRITISH POUND", alias: "GBP/USD", category: "forex", marketBullKey: "gbp" },
    { search: "JAPANESE YEN", alias: "USD/JPY", category: "forex", marketBullKey: "jpy" },
    { search: "AUSTRALIAN DOLLAR", alias: "AUD/USD", category: "forex", marketBullKey: "aud" },
    { search: "CANADIAN DOLLAR", alias: "USD/CAD", category: "forex", marketBullKey: "cad" },
    { search: "SWISS FRANC", alias: "USD/CHF", category: "forex", marketBullKey: "chf" },
    { search: "GOLD", alias: "GOLD", category: "commodity", marketBullKey: "gold" },
    { search: "SILVER", alias: "SILVER", category: "commodity" }, // No MarketBull
    { search: "CRUDE OIL", alias: "OIL", category: "commodity" }, // No MarketBull
    { search: "E-MINI S&P 500", alias: "S&P 500", category: "index", marketBullKey: "sp500" },
    { search: "NASDAQ-100", alias: "NASDAQ", category: "index", marketBullKey: "nasdaq" },
    { search: "U.S. DOLLAR INDEX", alias: "USD Index", category: "index", marketBullKey: "usd" },
];

const CFTC_LOCAL_FILE = path.join(__dirname, "../data/cot_raw.txt");
const MARKETBULL_MIRROR = path.join(__dirname, "../data/marketbull_cot.json");

async function fetchCOTData(forceRefresh = false) {
    // Hybrid: CFTC local mirror (net positions) + MarketBull mirror (indices)
    try {
        // 1. Load CFTC local mirror (cot_raw.txt)
        let cftcLines = [];
        if (fs.existsSync(CFTC_LOCAL_FILE)) {
            const raw = fs.readFileSync(CFTC_LOCAL_FILE, "utf8");
            cftcLines = raw.split("\n").filter(l => l.trim().length > 0);
            console.log(`📂 Loaded CFTC mirror: ${CFTC_LOCAL_FILE} (${cftcLines.length} lines)`);
        } else {
            console.warn("⚠️ CFTC local mirror not found:", CFTC_LOCAL_FILE);
        }

        // 2. Load MarketBull mirror (marketbull_cot.json)
        let mbMirror = {};
        if (fs.existsSync(MARKETBULL_MIRROR)) {
            mbMirror = JSON.parse(fs.readFileSync(MARKETBULL_MIRROR, "utf8"));
            console.log(`📂 Loaded MarketBull mirror: ${MARKETBULL_MIRROR} (${Object.keys(mbMirror.data || {}).length} assets)`);
        } else {
            console.warn("⚠️ MarketBull mirror not found:", MARKETBULL_MIRROR);
        }

        // 3. Build contracts from both sources
        const results = [];
        // Extract report date from CFTC file (more accurate) or fallback to MarketBull mirror
        let reportDate = mbMirror.lastUpdate || new Date().toISOString().split('T')[0];
        if (cftcLines.length > 0) {
            // CFTC format: "CONTRACT...",YYMMDD,YYYY-MM-DD,...
            const firstLine = cftcLines[0];
            const cols = firstLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (cols && cols.length >= 3) {
                // Column 2 is YYYY-MM-DD
                const dateCol = cols[2].replace(/^"|"$/g, '').trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateCol)) {
                    reportDate = dateCol;
                }
            }
        }

        for (const tracked of TRACKED_CONTRACTS) {
            const contract = {
                name: tracked.alias,
                category: tracked.category,
                openInterest: 0,
                speculator: { long: 0, short: 0, net: 0 },
                commercial: { long: 0, short: 0, net: 0 },
                sentiment: "N/A",
                marketBull: null
            };

            // A. Get net position & open interest from CFTC local mirror (parse CSV)
            if (cftcLines.length > 0) {
                const contractLine = cftcLines.find(l => l.toUpperCase().includes(tracked.search.toUpperCase()));
                if (contractLine) {
                    const cols = contractLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                    if (cols && cols.length >= 15) {
                        const cleanCols = cols.map(c => c.replace(/^"|"$/g, "").trim());
                        contract.openInterest = parseInt(cleanCols[7], 10) || 0;
                        const nonCommLong = parseInt(cleanCols[8], 10) || 0;
                        const nonCommShort = parseInt(cleanCols[9], 10) || 0;
                        const commLong = parseInt(cleanCols[11], 10) || 0;
                        const commShort = parseInt(cleanCols[12], 10) || 0;

                        contract.speculator.net = nonCommLong - nonCommShort;
                        contract.commercial.net = commLong - commShort;
                        contract.sentiment = contract.speculator.net > 0 ? "BULLISH" : contract.speculator.net < 0 ? "BEARISH" : "NETRAL";
                    }
                }
            }

            // B. Get MarketBull index enrichment (if available)
            if (tracked.marketBullKey && mbMirror.data && mbMirror.data[tracked.marketBullKey]) {
                const mb = mbMirror.data[tracked.marketBullKey];
                contract.marketBull = {
                    cotIndex6M: mb.index6M || "N/A",
                    cotIndex36M: mb.index36M || "N/A",
                    netPosition: mb.netPosition || "N/A",
                    chartUrl: mb.url || `https://market-bulls.com/cot-report-${tracked.marketBullKey}/`
                };
            }

            results.push(contract);
        }

        return {
            contracts: results,
            reportDate,
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
