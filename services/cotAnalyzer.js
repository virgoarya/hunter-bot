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

function analyzeCOTChanges(cotData) {
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

        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: process.env.OPENROUTER_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `Kamu adalah analis positioning institusional (desk-level assessment). Tugasmu hanya menginterpretasikan data COT dan konteks makro yang diberikan di input user.

ATURAN KERAS:
1. JANGAN menambah angka baru (net position, WoW change, crowding %, real yield, DXY, VIX, harga apapun) di luar yang tertulis di input.
2. JANGAN mengubah angka yang ada di input (anggap itu sudah benar).
3. JANGAN menyebut sumber data eksternal (Bloomberg, Reuters, dll). Anggap semua data hanya berasal dari "Data COT/Macro" yang dikirim user.
4. Fokus pada interpretasi: struktur posisi, arah aliran (build/unwind), crowding (rendah/sedang/ekstrem), risiko squeeze/unwind, dan bias ke depan yang bersifat kondisional.
5. Jika informasi makro tidak lengkap (misal DXY atau Real Yield = N/A), sebutkan bahwa konteks likuiditas terbatas dan bias harus dianggap lemah.

FRAMEWORK EVALUASI:
1. STRUCTURE:
   - Jelaskan untuk tiap aset utama: apakah net speculator besar/kecil, berubah signifikan atau tidak, crowding tinggi/rendah.
2. LIQUIDITY CONTEXT:
   - Hubungkan SECARA KUALITATIF dengan Real Yield, DXY, VIX dari input (naik/turun/tinggi/rendah), tanpa menambah angka.
3. POSITIONING PRESSURE:
   - Jelaskan apakah positioning saat ini lebih rawan continuation atau unwind/squeeze.
4. FORWARD RISK BIAS:
   - Nyatakan bias sebagai skenario kondisional, misalnya: "Continuation jika X", "Squeeze jika Y".

FORMAT OUTPUT WAJIB:

STRUKTUR POSISI (POSITIONING STRUCTURE):
- [Aset]: [net spec vs sejarah, crowding rendah/sedang/ekstrem]

ARAH ALIRAN (FLOW DIRECTION):
- [Build / Unwind / Acceleration / Distribution] per aset utama

KONTEKS LIKUIDITAS:
- Komentar singkat soal Real Yield, DXY, VIX (hanya dari angka input)

TEKANAN POSISI (POSITIONING PRESSURE):
- Risiko continuation vs risiko unwind/squeeze

BIAS RISIKO KE DEPAN:
- Bias kondisional, bukan kepastian. Hindari wording seolah-olah pasti terjadi.

Akhiri dengan kalimat:
"Ini interpretasi berbasis data COT mingguan, bukan sinyal entry/exit spesifik."`,
                    },
                    {
                        role: "user",
                        content: `Data COT/Macro:\n${cotSummary}\n\n${macroContext}`,
                    },
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                },
                timeout: 30000,
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("COT AI interpretation error:", error.message);
        return "Interpretasi AI tidak tersedia saat ini.";
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
