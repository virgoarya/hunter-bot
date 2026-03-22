const axios = require("axios");
const fs = require("fs");
const path = require("path");

const HISTORY_FILE = path.join(__dirname, "../data/cot_history.json");

// In-memory history storage for week-over-week comparison
let cotHistory = [];
const MAX_HISTORY = 52; // ~1 year of weekly data

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, "../data"))) {
    fs.mkdirSync(path.join(__dirname, "../data"));
}

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const raw = fs.readFileSync(HISTORY_FILE, "utf8");
            cotHistory = JSON.parse(raw);
            console.log(`📂 Loaded ${cotHistory.length} COT snapshots from disk.`);
        }
    } catch (err) {
        console.error("❌ Error loading COT history:", err.message);
        cotHistory = [];
    }
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(cotHistory, null, 2));
    } catch (err) {
        console.error("❌ Error saving COT history:", err.message);
    }
}

// Initial load
loadHistory();

function storeCOTSnapshot(cotData) {
    if (!cotData?.contracts?.length) return;

    // Prevent duplicate entries for the same report date
    if (cotHistory.some(snap => snap.date === cotData.reportDate)) {
        return;
    }

    cotHistory.push({
        date: cotData.reportDate,
        contracts: cotData.contracts.map((c) => ({
            name: c.name,
            netSpeculator: c.speculator.net,
            netCommercial: c.commercial.net,
            openInterest: c.openInterest,
        })),
        timestamp: Date.now(),
    });

    if (cotHistory.length > MAX_HISTORY) {
        cotHistory.shift();
    }

    saveHistory();
}

function analyzeCOTChanges(cotData, state = null) {
    if (!cotData?.contracts?.length) return null;

    const previousSnapshot =
        cotHistory.length >= 2
            ? cotHistory[cotHistory.length - 2]
            : null;

    const analysis = [];

    for (const contract of cotData.contracts) {
        const entry = {
            name: contract.name,
            category: contract.category,
            netSpeculator: contract.speculator.net,
            netCommercial: contract.commercial.net,
            sentiment: contract.sentiment,
            weeklyChange: null,
            signal: null,
            crowdingPercentile: 50, // Default
        };

        // Calculate weekly change
        if (previousSnapshot) {
            const prevContract = previousSnapshot.contracts.find(
                (c) => c.name === contract.name
            );
            if (prevContract) {
                entry.weeklyChange =
                    contract.speculator.net - prevContract.netSpeculator;

                // Detect signal type
                if (prevContract.netSpeculator > 0 && contract.speculator.net < 0) {
                    entry.signal = "FLIP_TO_SHORT";
                } else if (prevContract.netSpeculator < 0 && contract.speculator.net > 0) {
                    entry.signal = "FLIP_TO_LONG";
                } else if (prevContract.netSpeculator !== 0 && Math.abs(entry.weeklyChange / prevContract.netSpeculator) > 0.15) {
                    entry.signal = entry.weeklyChange > 0 ? "ACCELERATION_LONG" : "ACCELERATION_SHORT";
                }
            }
        }

        // Calculate crowding percentile based on history
        const historicalNets = cotHistory
            .flatMap((snap) =>
                snap.contracts
                    .filter((c) => c.name === contract.name)
                    .map((c) => c.netSpeculator)
            )
            .sort((a, b) => a - b);

        if (historicalNets.length >= 4) {
            const count = historicalNets.filter(v => v < contract.speculator.net).length;
            entry.crowdingPercentile = (count / historicalNets.length) * 100;

            if (entry.crowdingPercentile >= 90) entry.signal = entry.signal || "EXTREME_LONG_CROWDING";
            else if (entry.crowdingPercentile <= 10) entry.signal = entry.signal || "EXTREME_SHORT_CROWDING";
        }

        // --- ENHANCED COT LOGIC (MOMENTUM & PRICE ACTION) ---
        if (previousSnapshot && prevContract) {
            // 1. Smart Money Reversal (Commercials flip position drastically)
            const commercialChange = contract.commercial.net - prevContract.netCommercial;
            if (prevContract.netCommercial > 0 && contract.commercial.net < 0 && commercialChange < -10000) {
                entry.signal = "🚨 SMART_MONEY_REVERSAL (BEARISH)";
            } else if (prevContract.netCommercial < 0 && contract.commercial.net > 0 && commercialChange > 10000) {
                entry.signal = "🚨 SMART_MONEY_REVERSAL (BULLISH)";
            }
        }

        // 2. Extreme Positioning vs Price Action (Squeeze / Liquidation)
        if (state && state.isHealthy) {
            // Helper to get asset change percentage based on COT name
            let assetChange = 0;
            if (contract.name.includes("USD") || contract.name.includes("DOLLAR")) assetChange = parseFloat(state.DXY?.change) || 0;
            else if (contract.name.includes("GOLD")) assetChange = parseFloat(state.GOLD?.change) || 0;
            else if (contract.name.includes("NASDAQ") || contract.name.includes("S&P")) assetChange = parseFloat(state.NASDAQ?.change) || 0;
            
            if (entry.signal === "EXTREME_SHORT_CROWDING" && assetChange > 0.5) {
                entry.signal = "⚠️ POTENTIAL_SHORT_SQUEEZE";
            } else if (entry.signal === "EXTREME_LONG_CROWDING" && assetChange < -0.5) {
                entry.signal = "⚠️ POTENTIAL_LONG_LIQUIDATION";
            }
        }

        analysis.push(entry);
    }

    return analysis;
}

async function generateCOTInterpretation(cotData, analysis) {
    try {
        const { getMacroState } = require("./macroData");
        const state = getMacroState();

        const cotSummary = (analysis || [])
            .map((a) => {
                const change = a.weeklyChange
                    ? ` (WoW: ${a.weeklyChange > 0 ? "+" : ""}${a.weeklyChange.toLocaleString()})`
                    : "";
                const signal = a.signal ? ` [${a.signal}]` : "";
                const crowding = ` (Crowding: ${a.crowdingPercentile.toFixed(1)}%)`;
                return `${a.name}: Leveraged Funds Net ${a.netSpeculator > 0 ? "+" : ""}${a.netSpeculator.toLocaleString()}${change}${crowding}${signal}`;
            })
            .join("\n");

        const macroContext = state?.isHealthy ? `
Konteks Makro:
- Indeks DXY: ${state.DXY?.close ?? "N/A"}
- Real Yield (10Y): ${state.RealYield?.close ?? "N/A"}%
- Nominal US10Y: ${state.US10Y?.close ?? "N/A"}%
- Indeks VIX: ${state.VIX?.close ?? "N/A"}
- EMAS: ${state.GOLD?.close ?? "N/A"}
` : "Konteks likuiditas diperlukan untuk menentukan bias arah.";

        // Check if we already have a cached interpretation for this report date
        const existingSnapshot = cotHistory.find(snap => snap.date === cotData.reportDate);
        if (existingSnapshot && existingSnapshot.interpretation) {
            console.log(`🤖 Using cached AI interpretation for ${cotData.reportDate}`);
            return existingSnapshot.interpretation;
        }

        const { postToAI } = require("../utils/aiProxy");
        const messages = [
            { role: "system", content: "Anda adalah pakar analisis Institutional Positioning (COT). Analisis data ini dengan gaya Hedge Fund Desk. Fokus pada pergeseran Leveraged Funds vs Commercials." },
            { role: "user", content: `Analisis data COT berikut:\n${cotSummary}\n\n${macroContext}\n\nBerikan interpretasi profesional singkat (max 3 paragraf).` }
        ];

        const interpretation = await postToAI(messages, {
            temperature: 0.2 // More stable for analysis
        });

        // Cache the interpretation if we found a snapshot
        if (existingSnapshot) {
            existingSnapshot.interpretation = interpretation;
            saveHistory();
        }

        return interpretation;
    } catch (error) {
        const errorData = error.response?.data?.error || {};
        console.error("❌ COT AI Error Detail:", errorData.message || error.message);

        if (error.response?.status === 402 || (error.response?.status === 429 && errorData.message?.includes("credits"))) {
            return "❌ [OpenRouter] Saldo/Credit habis. Tambahkan minimal $5 di OpenRouter untuk kuota 1000 free-request/hari.";
        }
        if (error.response?.status === 429) {
            return "⚠️ [OpenRouter] Limit harian tercapai. Coba lagi besok atau tambahkan saldo OpenRouter.";
        }
        return "Interpretasi AI tidak tersedia saat ini. Periksa koneksi API atau saldo OpenRouter.";
    }
}

function formatCOTAnalysis(analysis) {
    if (!analysis?.length) return "";

    let text = "\n🔍 **POSISI INSTITUSIONAL:**\n\n";

    const significantPositions = analysis.filter(
        (a) => a.signal || Math.abs(a.crowdingPercentile - 50) > 30 || (a.weeklyChange && Math.abs(a.weeklyChange) > 2000)
    );

    if (significantPositions.length === 0) {
        text += "Tidak ada pergeseran posisi institusional yang signifikan terdeteksi.\n";
        return text;
    }

    for (const entry of significantPositions) {
        const changeText = entry.weeklyChange
            ? ` (${entry.weeklyChange > 0 ? "↑" : "↓"} ${Math.abs(entry.weeklyChange).toLocaleString()})`
            : "";

        const crowdingTag = entry.crowdingPercentile >= 80 ? " [Extreme Long]" : (entry.crowdingPercentile <= 20 ? " [Extreme Short]" : "");

        let icon = "🔹";
        if (entry.signal?.includes("ACCELERATION")) icon = "⚡";
        else if (entry.signal?.includes("EXTREME")) icon = "⚠️";
        else if (entry.signal?.includes("FLIP")) icon = "🔄";

        text += `${icon} **${entry.name}**: ${entry.sentiment}${changeText}${crowdingTag}\n`;
    }

    return text;
}

module.exports = {
    storeCOTSnapshot,
    analyzeCOTChanges,
    generateCOTInterpretation,
    formatCOTAnalysis,
};
