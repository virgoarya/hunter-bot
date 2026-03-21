const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const ASSETS = {
    gold: "https://market-bulls.com/cot-report-gold/",
    usd: "https://market-bulls.com/cot-report-us-dollar-usd/",
    eur: "https://market-bulls.com/cot-report-euro-fx-eur/",
    gbp: "https://market-bulls.com/cot-report-british-pound-gbp/",
    jpy: "https://market-bulls.com/cot-report-japanese-yen-jpy/",
    aud: "https://market-bulls.com/cot-report-australian-dollar-aud/",
    cad: "https://market-bulls.com/cot-report-canadian-dollar-cad/",
    chf: "https://market-bulls.com/cot-report-swiss-franc-chf/",
    sp500: "https://market-bulls.com/cot-report-sp-500/",
    nasdaq: "https://market-bulls.com/cot-report-nasdaq-100/"
};

const MIRROR_FILE = path.join(__dirname, "../data/marketbull_cot.json");

async function fetchMarketBullCOT(assetKey) {
    let data = {
        asset: assetKey,
        cotIndex6M: "N/A",
        cotIndex36M: "N/A",
        netPosition: "N/A",
        lastUpdate: "N/A",
        chartUrl: ASSETS[assetKey] || "https://market-bulls.com/cot-report"
    };

    try {
        const url = ASSETS[assetKey];
        if (!url) return null;

        // 1. Try Live Fetch first (with robust headers)
        try {
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
                },
                timeout: 5000
            });

            const $ = cheerio.load(response.data);
            
            // Extract COT Index from SVG/Guages
            $(".su-column").each((i, col) => {
                const label = $(col).find("span").text();
                const val = $(col).find("text.val").text();
                if (label.includes("6 Month")) data.cotIndex6M = val + "%";
                if (label.includes("36 Month")) data.cotIndex36M = val + "%";
            });

            // Extract Net Position
            $("table.last_cot_table tbody tr").each((i, row) => {
                const cells = $(row).find("td");
                if (cells.eq(0).text().includes("Net Positions")) {
                    const val = cells.eq(3).text().trim();
                    if (val) data.netPosition = val;
                }
            });

            // Extract Date
            const dateMatch = $.html().match(/Report Date: (\d{4}-\d{2}-\d{2})/i);
            if (dateMatch) data.lastUpdate = dateMatch[1];

            // Cleanup
            if (data.cotIndex6M) data.cotIndex6M = data.cotIndex6M.replace("%%", "%");
            if (data.cotIndex36M) data.cotIndex36M = data.cotIndex36M.replace("%%", "%");

        } catch (err) {
            // Live fetch failed (likely Cloudflare), but we'll try the mirror next
        }

        // 2. Fallback to Local Mirror if live data is missing
        if (fs.existsSync(MIRROR_FILE) && (data.cotIndex6M === "N/A" || data.netPosition === "N/A")) {
            const mirror = JSON.parse(fs.readFileSync(MIRROR_FILE, "utf8"));
            if (mirror.data[assetKey]) {
                const m = mirror.data[assetKey];
                data.cotIndex6M = data.cotIndex6M === "N/A" ? m.index6M : data.cotIndex6M;
                data.cotIndex36M = data.cotIndex36M === "N/A" ? m.index36M : data.cotIndex36M;
                data.netPosition = data.netPosition === "N/A" ? m.netPosition : data.netPosition;
                data.lastUpdate = data.lastUpdate === "N/A" ? mirror.lastUpdate : data.lastUpdate;
            }
        }

        return data;
    } catch (e) {
        console.error(`❌ MarketBull Scraper Error (${assetKey}):`, e.message);
        return null;
    }
}

module.exports = { fetchMarketBullCOT };
