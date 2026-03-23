const { EmbedBuilder } = require("discord.js");
const { fetchEconomicCalendar } = require("./economicCalendar");
const { generateCalendarInterpretation } = require("./calendarAnalyzer");
const { getMacroState } = require("./macroData");
const { classifyRegime } = require("./regime");
const { postToAI } = require("../utils/aiProxy");

const broadcastedReleases = new Set();
let lastForceRefreshTime = 0;

async function buildCalendarBroadcast() {
    const events = await fetchEconomicCalendar();

    if (!events || events.length === 0) {
        return { content: "📭 **Tidak ada data kalender ekonomi tersedia saat ini.**" };
    }

    const eventItems = events.filter(e => e.type === "event");
    if (eventItems.length === 0) {
        return { content: "📭 **Tidak ada event ekonomi penting dalam radar minggu ini.**" };
    }

    const groups = {};
    eventItems.forEach(e => {
        if (!e.date) return;
        const d = new Date(e.date);
        const dateKey = d.toLocaleDateString("id-ID", { weekday: 'short', month: 'short', day: 'numeric', timeZone: "Asia/Jakarta" });

        // Abaikan hari Minggu (Min) dan Sabtu (Sab)
        if (dateKey.startsWith("Min") || dateKey.startsWith("Sab")) return;

        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(e);
    });

    // Dapatkan macro state saat ini untuk What-If Scenario
    const state = getMacroState();
    let whatIfScenario = "Menganalisa skenario pasar...";

    if (state && state.isHealthy) {
        try {
            const regime = classifyRegime(state);
            // Cari event paling penting minggu ini
            const topEvents = events.filter(e => e.impact === "High" && e.event && !e.event.toLowerCase().includes("holiday")).slice(0, 2);

            if (topEvents.length > 0) {
                const eventNames = topEvents.map(e => `\`${e.event} (\${e.country})\``).join(" dan ");

                const prompt = `
Kamu adalah Senior Macro Analyst di Institutional Desk.

KONTEKS PASAR SAAT INI:
- Rezim: ${regime.regime} (${regime.description})

EVENT YANG AKAN DIRILIS:
${eventNames}

TUGAS:
Buatkan analisis "What-If Scenario" yang komprehensif untuk data-release tersebut. Output harus dalam 2-3 paragraf padat (150-250 kata) dengan struktur:

**Paragraf 1**: Jelaskan skenario BEAT vs MISS vs IN-LINE terhadap forecast, dan dampak instan ke DXY, Gold, NASDAQ/US10Y.

**Paragraf 2**: Kaitkan dengan narasi makro saat ini (apakah perubahan data ini akan mengubah ekspektasi Fed? Apakah memperkuat/melemahkan narasi inflasi/growth?)

**Paragraf 3** (opsional): Berikan bias trading singkat (risk-on/off,避险/risk assets) untuk timeframe intraday hingga 1 minggu.

HARUS: Gunakan bahasa Indonesia profesional, to-the-point. JANGAN mulai dengan "Sebagai Senior Macro Analyst..." atau "Analisis ini...". LGSG berikan analisisnya.`;

                const messages = [
                    { role: "system", content: "Kamu adalah Senior Macro Analyst yang memberikan analisis What-IF berbasis regime untuk event ekonomi besar. Output HANYA berisi analisis, tanpa pengenalan 'Sebagai...', 'Berikut...', atau 'Analisis...'. Langsung ke inti." },
                    { role: "user", content: prompt }
                ];
                const rawResponse = await postToAI(messages, { temperature: 0.6, max_tokens: 500 });

                // Clean up: Remove any meta-commentary
                whatIfScenario = rawResponse
                    .replace(/^(Sebagai Senior Macro Analyst|Saya adalah|Analisis What-IF|Berikut analisis|Konteks|EVENT|TUGAS)[^\n]*\n*/i, '')
                    .replace(/^Analysis|Scenario:?\s*/i, '')
                    .trim();

                // Fallback
                if (!whatIfScenario || whatIfScenario.length < 30) {
                    whatIfScenario = rawResponse.trim();
                }
            } else {
                whatIfScenario = "Tidak ada event tier-1 berdampak tinggi minggu ini.";
            }
        } catch (e) {
            console.error("What-If AI Error:", e.message);
            whatIfScenario = "Skenario AI tidak tersedia saat ini.";
        }
    }

    // Truncate if needed for Discord embed field limit (1024 chars)
    let scenarioDisplay = whatIfScenario;
    if (scenarioDisplay && scenarioDisplay.length > 1000) {
        scenarioDisplay = scenarioDisplay.substring(0, 997) + "...";
    }

    // Build Calendar Embed (only events)
    const calendarEmbed = new EmbedBuilder()
        .setTitle("📅 KALENDER EKONOMI MINGGUAN")
        .setColor("#3498db")
        .setDescription("Peristiwa institusional utama dalam radar minggu ini.")
        .setTimestamp()
        .setFooter({ text: "Semua waktu dalam WIB (UTC+7)" });

    const sortedDates = Object.keys(groups).sort((a, b) => new Date(groups[a][0].date) - new Date(groups[b][0].date));

    // Only show first 5 days
    for (const dateKey of sortedDates.slice(0, 5)) {
        const dayEvents = groups[dateKey];
        let dayText = "";
        const formatted = dayEvents.map(e => {
            let impactEmoji = "🟢";
            if (e.impact === "High") impactEmoji = "🔴";
            else if (e.impact === "Medium") impactEmoji = "🟡";
            let timeStr = "N/A";
            try {
                const eventDate = new Date(e.date);
                timeStr = eventDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
            } catch { timeStr = "Check" }
            return { ...e, impactEmoji, timeWIB: timeStr };
        });
        const highImpact = formatted.filter(e => e.impact === "High" || e.event.toLowerCase().includes("holiday"));
        if (highImpact.length === 0) {
            dayText = "_Tidak ada berita berdampak tinggi_";
        } else {
            highImpact.forEach(e => {
                const source = e.source ? `[${e.source}] ` : "";
                const row = `${e.impactEmoji} \`${e.timeWIB}\` ${source}**${e.country}**: ${e.event} (\`${e.actual || "N/A"}\`/\`${e.forecast || "N/A"}\`/\`${e.previous || "N/A"}\`)\n`;
                if ((dayText + row).length < 1010) dayText += row;
            });
        }
        calendarEmbed.addFields({ name: `🗓️ ${dateKey.toUpperCase()}`, value: dayText || "_Tidak ada_", inline: false });
    }

    // Build separate embed for What-If Scenario
    let scenarioEmbed = null;
    if (scenarioDisplay && scenarioDisplay !== "Menganalisa skenario pasar...") {
        scenarioEmbed = new EmbedBuilder()
            .setTitle("🔮 What-If Scenario Analysis")
            .setColor("#9b59b6")
            .setDescription(`*${scenarioDisplay}*`)
            .setTimestamp()
            .setFooter({ text: "Hunter Bot • Macro Context" });
    }

    return { embeds: scenarioEmbed ? [calendarEmbed, scenarioEmbed] : [calendarEmbed] };
}

module.exports = { buildCalendarBroadcast, getHighImpactAlerts, getNewReleaseAlerts };
