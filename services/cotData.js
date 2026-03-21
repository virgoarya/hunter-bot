const axios = require("axios");

// CFTC Combined Futures-Only Short Format (easier to parse)
const CFTC_CSV_URL = "https://cftc.gov/dea/newcot/deafut.txt";

const CACHE_MS = 12 * 60 * 60 * 1000; // 12 hours (COT updates weekly)
let cotCache = { data: null, updatedAt: 0 };

// Contract names to track (partial match in CFTC report)
const TRACKED_CONTRACTS = [
    { search: "EURO FX", alias: "EUR/USD", category: "forex" },
    { search: "BRITISH POUND", alias: "GBP/USD", category: "forex" },
    { search: "JAPANESE YEN", alias: "USD/JPY", category: "forex" },
    { search: "AUSTRALIAN DOLLAR", alias: "AUD/USD", category: "forex" },
    { search: "CANADIAN DOLLAR", alias: "USD/CAD", category: "forex" },
    { search: "SWISS FRANC", alias: "USD/CHF", category: "forex" },
    { search: "GOLD", alias: "GOLD", category: "commodity" },
    { search: "SILVER", alias: "SILVER", category: "commodity" },
    { search: "CRUDE OIL", alias: "OIL", category: "commodity" },
    { search: "E-MINI S&P 500", alias: "S&P 500", category: "index" },
    { search: "NASDAQ-100", alias: "NASDAQ", category: "index" },
];

async function fetchCOTData(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cotCache.data && now - cotCache.updatedAt < CACHE_MS) {
        return cotCache.data;
    }

    try {
        const rawData = await fetchCFTCReport(CFTC_CSV_URL);

        if (!rawData) {
            console.error("CFTC report URL failed");
            return cotCache.data || null;
        }

        const parsed = parseCOTReport(rawData);
        cotCache = { data: parsed, updatedAt: now };
        return parsed;
    } catch (error) {
        console.error("COT Data fetch error:", error.message);
        return cotCache.data || null;
    }
}

async function fetchCFTCReport(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`📡 Fetching CFTC report (Attempt ${i + 1}/${retries})...`);
            const response = await axios.get(url, {
                timeout: 30000,
                responseType: "text",
                headers: {
                    "User-Agent": "PostmanRuntime/7.35.0",
                    "Accept": "*/*",
                    "Cache-Control": "no-cache"
                },
            });

            if (response.data && response.data.includes("WHEAT")) return response.data;
        } catch (error) {
            console.warn(`⚠️ CFTC fetch attempt ${i + 1} failed:`, error.message);
            if (i < retries - 1) {
                const delay = (i + 1) * 2000;
                console.log(`⏳ Retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    return null;
}

function parseCOTReport(rawText) {
    const results = [];
    let reportDate = "Unknown";

    const lines = rawText.split("\n").filter(l => l.trim().length > 0);

    for (const tracked of TRACKED_CONTRACTS) {
        // Find the line that starts with or contains the contract name
        const contractLine = lines.find(l => l.toUpperCase().includes(tracked.search.toUpperCase()));

        if (contractLine) {
            // It's a CSV format, but can contain quoted strings with commas inside, e.g., "EURO FX - CHICAGO MERCANTILE EXCHANGE"
            // Simple parse approach: split by comma, handling quotes if necessary. 
            // CFTC typical lines: "WHEAT-SRW - CHICAGO...",260224,2026-02-24,001602,...

            const cols = contractLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!cols || cols.length < 15) continue; // safety check

            // Clean quotes and spaces
            const cleanCols = cols.map(c => c.replace(/^"|"$/g, "").trim());

            if (reportDate === "Unknown") {
                reportDate = cleanCols[2]; // Usually YYYY-MM-DD
            }

            // Based on CFTC short format columns:
            // 7 = Open Interest
            // 8 = Non-Commercial Long (Speculator)
            // 9 = Non-Commercial Short (Speculator)
            // 10 = Non-Commercial Spreads
            // 11 = Commercial Long
            // 12 = Commercial Short

            const openInterest = parseInt(cleanCols[7], 10) || 0;
            const nonCommLong = parseInt(cleanCols[8], 10) || 0;
            const nonCommShort = parseInt(cleanCols[9], 10) || 0;
            const commLong = parseInt(cleanCols[11], 10) || 0;
            const commShort = parseInt(cleanCols[12], 10) || 0;

            const netSpeculator = nonCommLong - nonCommShort;
            const netCommercial = commLong - commShort;

            results.push({
                name: tracked.alias,
                category: tracked.category,
                openInterest,
                speculator: { long: nonCommLong, short: nonCommShort, net: netSpeculator },
                commercial: { long: commLong, short: commShort, net: netCommercial },
                sentiment: netSpeculator > 0 ? "BULLISH" : netSpeculator < 0 ? "BEARISH" : "NETRAL",
            });
        }
    }

    return {
        contracts: results,
        reportDate,
        fetchedAt: new Date().toISOString(),
    };
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

        const line = `${arrow} **${contract.name}** — Speculators: ${netFormatted} | Comm: ${contract.commercial.net > 0 ? "+" : ""}${contract.commercial.net.toLocaleString()}`;

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
