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

            // Detect regime shift if available
            let regimeShiftInfo = "";
            try {
                const { getHistoricalRegime } = require("./regimeTracker");
                const prevRegime = getHistoricalRegime(1);
                if (prevRegime && prevRegime !== regime.regime) {
                    regimeShiftInfo = `\nREGIME SHIFT: ${prevRegime} → ${regime.regime} (Market interpreting through new regime lens)`;
                }
            } catch (e) {}

            // Get correlation patterns
            const { detectDivergences } = require("./correlationEngine");
            const divergences = detectDivergences(state);
            const divText = divergences.length > 0 ? `\nDIVERGENSI TERDETEKSI: ${divergences.join(" | ")}` : "";

            // Cari event paling penting minggu ini
            const topEvents = events.filter(e => e.impact === "High" && e.event && !e.event.toLowerCase().includes("holiday")).slice(0, 2);

            if (topEvents.length > 0) {
                const eventNames = topEvents.map(e => `\`${e.event} (${e.country})\``).join(" dan ");
                const eventList = topEvents.map(e => `- ${e.event} (${e.country})`).join("\n");

                // Extract key market levels for context
                const marketContext = `
DXY: ${state.DXY?.close ?? "N/A"} (${state.DXY?.change ?? "0"}%)
US10Y: ${state.US10Y?.close ?? "N/A"}% (${state.US10Y?.change ?? "0"}%)
NASDAQ: ${state.NASDAQ?.close ?? "N/A"} (${state.NASDAQ?.change ?? "0"}%)
GOLD: ${state.GOLD?.close ?? "N/A"} (${state.GOLD?.change ?? "0"}%)
VIX: ${state.VIX?.close ?? "N/A"}
${regimeShiftInfo}${divText}`;

                const prompt = `
## WHAT-IF SCENARIO ANALYSIS - CRITICAL THINKING FRAMEWORK

EVENT YANG AKAN DIRILIS:
${eventList}

KONTEKS PASAR SAAT INI:
- Rezim: ${regime.regime} (${regime.description})
${marketContext}

## PROTOKOL ANALISIS:

**1. BEAT/MISS/IN-LINE QUANTIFICATION**
For EACH event:
- Expected move magnitude (based on historical avg impact): DXY ±X bps, Gold ±Y$, etc.
- If BEAT > forecast by >0.5% for CPI/NFP, expect immediate reaction.
- If MISS > forecast by >0.5%, opposite reaction.
- If in-line, reaction minimal (often fade).

**2. CAUSE-EFFECT CHAIN (MUST EXPLAIN)**
Do not just state "DXY strengthens". Explain WHY:
Example: "Higher CPI → Fed tightening expectations ↑ → USD demand ↑ → DXY +0.5% within 1 hour"

**3. REGIME CONTEXT**
- How does current regime (${regime.regime}) color the reaction?
- Example: In RISK-OFF regime, even positive data may be seen as "bad" (keeps Fed hawkish → hurts equities).
- Example: In INFLATION regime, any hot data reinforces Tighter-for-Longer narrative.

**4. REGIME SHIFT IMPACT**${regimeShiftInfo ? '- Market transitioning regimes changes interpretation of data. Explain OLD vs NEW regime lens.' : ''}

**5. DIVERGENCE CONSIDERATION**${divText ? '- Smart money may have already positioned. Divergence suggests potential squeeze/reversal.' : ''}

**6. TIMEFRAME & FADE POTENTIAL**
- Intraday (2-4h): Initial algo reaction, may fade if data priced-in.
- Short-term (1-3d): Sustained move if data changes Fed/inflation narrative.
- Structural (>1w): Rare, requires regime change or policy shift.
- Fade risk: Assess if deviation was small (<0.3%) → likely already priced.

**7. CONFIDENCE & TRIGGER**
- Confidence: High (>75%) / Medium (50-75%) / Low (<50%)
- Key trigger level: "If CPI > 3.5%, DXY +0.8% within 2h"
- Invalidation: "If Core CPI < 3.0%, thesis wrong"

## OUTPUT FORMAT:

**WHAT-IF SCENARIO ANALYSIS**

[Event 1 Name]:
BEAT/MISS: [ ] dengan deviasi [X]%
即刻 dampak: DXY ±X bps, Gold ±Y$, Nasdaq ±Z%
Mechanism: (Jelaskan cause-effect chain dalam 1-2 kalimat)
Regime filter: (How ${regime.regime} regime modifies reaction?)
Timeframe: [intraday / short-term / structural]
Confidence: [High/Med/Low] - alasan singkat
Key trigger: "[Specific condition]"
Invalidation: "[Opposite condition]"

[Event 2 Name]: (same structure)
[...]

**CONSOLIDATED BIAS FOR WEEK:**
Based on combined event impact:
- Risk-On / Risk-Off / Neutral
- DXY bias: [Long/Short/Neutral]
- Gold bias: [Long/Short/Neutral]
- Note any expected reversal/fade conditions.

## RULES:
- Gunakan angka spesifik dari konteks (DXY 104.5, bukan "DXY saat ini").
- Jangan Meredith data yang diberikan.
- Jangan mulai dengan "Sebagai Senior Macro Analyst..." - langsung ke analisis.
- Output应精简但必须包含所有关键要素.
`;

                const systemContent = `Kamu adalah Senior Macro Analyst Institutional Desk yang menganalisis What-If scenario dengan critical thinking framework.

PRINSIP:
1. Quantitative: Berikan angka dampak perkiraan (DXY ±X bps, Gold ±Y$).
2. Mechanism: Jelaskan WHY reaksi akan terjadi (cause-effect).
3. Regime-aware: InterpretasiBergantung pada rezim pasar saat ini.
4. Uncertainty: Confidence rating + invalidation condition.
5.Precision: Gunakan data spesifik dari konteks, jangan approximate.

Output HANYA berisi analisis sesuai format di atas, tanpa pengenalan atau sambutan. Langsung ke "WHAT-IF SCENARIO ANALYSIS".`;

                const messages = [
                    { role: "system", content: systemContent },
                    { role: "user", content: prompt }
                ];
                const rawResponse = await postToAI(messages, { temperature: 0.5, max_tokens: 1000 });

                console.log(`📦 Raw What-If response: ${rawResponse.length} chars`);

                // Clean up
                whatIfScenario = rawResponse
                    .replace(/^(Sebagai Senior Macro Analyst|Saya adalah|Analisis What-IF|Berikut analisis|Konteks|EVENT|TUGAS)[^\n]*\n*/i, '')
                    .replace(/^Analysis|Scenario:?\s*/i, '')
                    .trim();

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

    // Truncate if needed for Discord embed description limit (4096 chars)
    let scenarioDisplay = whatIfScenario;
    if (scenarioDisplay && scenarioDisplay.length > 4090) {
        scenarioDisplay = scenarioDisplay.substring(0, 4087) + "...";
    }

    // Debug: Log actual length to monitor truncation
    if (scenarioDisplay && scenarioDisplay.length > 3000) {
        console.log(`📏 What-If scenario after cleanup: ${scenarioDisplay.length} chars`);
    }

    const calendarEmbed = new EmbedBuilder()
        .setTitle("📅 KALENDER EKONOMI MINGGUAN")
        .setColor("#3498db")
        .setDescription("Peristiwa institusional utama dalam radar minggu ini.")
        .setTimestamp()
        .setFooter({ text: "Semua waktu dalam WIB (UTC+7)" });

    const sortedDates = Object.keys(groups).sort((a, b) => new Date(groups[a][0].date) - new Date(groups[b][0].date));

    // Only show first 5 days to avoid field limits or too long message
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
                if ((dayText + row).length < 1020) dayText += row;
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

async function getHighImpactAlerts() {
    const events = await fetchEconomicCalendar();
    if (!events?.length) return [];

    const now = Date.now();
    const thirtyMinMs = 30 * 60 * 1000;

    return events.filter((e) => {
        if (e.type !== "event" || !e.date) return false;
        const isHigh = e.impact === "High";
        if (!isHigh) return false;

        try {
            const eventDate = new Date(e.date).getTime();
            const timeDiff = eventDate - now;
            return timeDiff > 0 && timeDiff <= thirtyMinMs;
        } catch { return false; }
    });
}

async function getNewReleaseAlerts() {
    // 1. Soft Fetch (Use Cache)
    let events = await fetchEconomicCalendar(false);
    if (!events?.length) return [];

    const now = new Date();
    const nowMs = now.getTime();
    const todayStr = now.toISOString().split("T")[0];

    // 2. Cek apakah ada event High/Medium Impact hari ini yang SUDAH berlalu (maksimal 3 jam) tapi 'actual' belum tercatat
    const needsForceRefresh = events.some(e => {
        if (e.type !== "event" || !e.date || (e.impact !== "High" && e.impact !== "Medium")) return false;

        const isToday = e.date.includes(todayStr) || new Date(e.date).toDateString() === now.toDateString();
        if (!isToday) return false;

        const eventTime = new Date(e.date).getTime();
        const minTimePassed = 5 * 60 * 1000; // Mulai cek setiap 5 menit setelah event
        const maxTimeWait = 3 * 60 * 60 * 1000; // Berhenti cek setelah 3 jam

        const timeDiff = nowMs - eventTime;
        return timeDiff > minTimePassed && timeDiff < maxTimeWait && (!e.actual || e.actual === "N/A" || e.actual.trim() === "");
    });

    // 3. Jika "Ya", baru lakukan pemanggilan paksa ke API AlphaVantage / FairEconomy
    // Cooldown 15 menit untuk force refresh agar tidak membakar limit AV 25/day
    const REFRESH_COOLDOWN = 15 * 60 * 1000;

    if (needsForceRefresh && (nowMs - lastForceRefreshTime > REFRESH_COOLDOWN)) {
        console.log("⚡ High impact event passed. Forcing refresh for actuals...");
        lastForceRefreshTime = nowMs;
        events = await fetchEconomicCalendar(true);
    }

    const alerts = [];

    for (const e of events) {
        if (e.type !== "event" || !e.date) continue;

        const isToday = e.date.includes(todayStr) || new Date(e.date).toDateString() === now.toDateString();
        if (!isToday) continue;
        if (e.impact !== "High" && e.impact !== "Medium") continue;
        if (!e.actual || e.actual === "N/A" || e.actual.trim() === "") continue;

        const eventId = `${e.date}_${e.country}_${e.event}`;
        if (broadcastedReleases.has(eventId)) continue;

        broadcastedReleases.add(eventId);

        if (broadcastedReleases.size > 100) {
            const iterator = broadcastedReleases.values();
            broadcastedReleases.delete(iterator.next().value);
        }

        const interpretation = await generateCalendarInterpretation(e);

        const embed = new EmbedBuilder()
            .setTitle(`🚨 RILIS DATA TERBARU: ${e.country}`)
            .setColor(e.impact === "High" ? "#e74c3c" : "#f1c40f")
            .setDescription(`**${e.event}**`)
            .addFields(
                { name: "✅ Aktual", value: `**${e.actual}**`, inline: true },
                { name: "🎯 Perkiraan", value: e.forecast || "N/A", inline: true },
                { name: "📊 Sebelumnya", value: e.previous || "N/A", inline: true }
            )
            .setTimestamp();

        if (interpretation) {
            // Truncate interpretation to safe limit (1024 max for field value)
            const truncatedInterpretation = interpretation.length > 1000
                ? interpretation.substring(0, 997) + "..."
                : interpretation;
            embed.addFields({ name: "🧠 Catatan Cepat Sektor Institusional", value: truncatedInterpretation, inline: false });
        }

        alerts.push({ embeds: [embed] });
    }

    return alerts;
}

module.exports = { buildCalendarBroadcast, getHighImpactAlerts, getNewReleaseAlerts };
