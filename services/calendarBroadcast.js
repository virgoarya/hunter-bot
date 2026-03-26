const { EmbedBuilder } = require("discord.js");
const { fetchEconomicCalendar } = require("./economicCalendar");
const { getMacroState } = require("./macroData");
const { classifyRegime } = require("./regime");
const { postToAI } = require("../utils/aiProxy");

const broadcastedReleases = new Set();
let lastForceRefreshTime = 0;

// Cache untuk What-If scenarios per event (eventId => whatIfText)
const whatIfCache = new Map();

/**
 * Generate What-If scenario untuk sebuah event high-impact
 */
async function generateWhatIfForEvent(event, state, regime, regimeShiftInfo = "", divergences = []) {
    // Defensive field access with fallbacks
    const country = event.country || "Global";
    const eventName = event.event || "Unknown Event";
    const forecast = event.forecast || "N/A";
    const previous = event.previous || "N/A";

    const eventId = `${event.date}_${country}_${eventName}`;

    // Check cache first (cache for 1 hour)
    const cached = whatIfCache.get(eventId);
    if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
        return cached.text;
    }

    try {
        const marketContext = `
DXY: ${state.DXY?.close ?? "N/A"} (${state.DXY?.change ?? "0"}%)
US10Y: ${state.US10Y?.close ?? "N/A"}% (${state.US10Y?.change ?? "0"}%)
NASDAQ: ${state.NASDAQ?.close ?? "N/A"} (${state.NASDAQ?.change ?? "0"}%)
GOLD: ${state.GOLD?.close ?? "N/A"} (${state.GOLD?.change ?? "0"}%)
VIX: ${state.VIX?.close ?? "N/A"}
${regimeShiftInfo}
DIVERGENSI: ${divergences.length > 0 ? divergences.join(" | ") : "Tidak terdeteksi"}`;

        const prompt = `
## WHAT-IF SCENARIO ANALYSIS

EVENT: ${eventName} (${country})
FORECAST: ${forecast}
SEBELUMNYA: ${previous}

KONTEKS PASAR SAAT INI:
- Rezim: ${regime.regime} (${regime.description})
${marketContext}

## PROTOKOL ANALISIS:

**1. KUALIFIKASI BEAT/MISS/IN-LINE**
- Estimasi dampak magnitude: DXY ±X bps, Gold ±Y$, Nasdaq ±Z%
- BEAT > forecast 0.5%: reaksi kuat
- MISS > forecast 0.5%: reaksi sebaliknya
- In-line: reaksi minimal

**2. CHAIN CAUSE-EFFECT**
Jelaskan alur sebab-akibat: "CPI tinggi → Fed hawkish → USD menguat"

**3. KONTEKS REGIME**
- Bagaimana regime ${regime.regime} mempengaruhi reaksi?
- Contoh: regime INFLASI, data panas memperkuat narasi "Tighter-for-Longer"

**4. DAMPAK REGIME SHIFT**${regimeShiftInfo ? '- Regime shift sedang berlangsung, interpretasi data bisa berubah.' : ''}

**5. PERTIMBANGAN DIVERGENSI**${divergences.length > 0 ? `- Divergences: ${divergences.join(", ")} bisa menyebabkan squeeze/reversal.` : ''}

**6. TIMEFRAME & POTENSI FADE**
- Intraday (2-4 jam): Reaksi algo, mungkin fade jika priced-in
- Short-term (1-3 Hari): Gerakan berkelanjutan jika ubah narasi Fed
- Structural (>1 minggu): Langka, butuh regime change
- Risiko fade: deviasi <0.3% → likely sudah priced

**7. CONFIDENCE & TRIGGER**
- Confidence: High (>75%) / Medium (50-75%) / Low (<50%)
- Key trigger: "Jika [condition], maka [reaksi]"
- Invalidation: "Jika [condition sebaliknya], thesis wrong"

## OUTPUT FORMAT (BAHASA INDONESIA):

**WHAT-IF: [Nama Event]**

Beat/Miss: [lebih tinggi/lebih rendah/sesuai] forecast dengan deviasi [X]%
Dampak Instan:
- DXY: ±X bps
- Gold: ±Y$
- Nasdaq: ±Z%
Mechanism: [Jelaskan cause-effect dalam 1-2 kalimat]
Regime Filter: [Bagaimana regime ${regime.regime} memodifikasi reaksi?]
Timeframe: [intraday / short-term / structural]
Confidence: [High/Med/Low] - [alasan]
Key Trigger: "[Kondisi spesifik]"
Invalidation: "[Kondisi sebaliknya]"

CATATAN: Output HANYA analisis, tanpa pengenalan. Gunakan Indonesia 100%.
`;

        const messages = [
            { role: "system", content: "Kamu adalah Senior Macro Analyst. Berikan what-if scenario analisis dalam Bahasa Indonesia." },
            { role: "user", content: prompt }
        ];

        const rawResponse = await postToAI(messages, { temperature: 0.5, max_tokens: 500 });

        // Clean up
        let analysis = rawResponse
            .replace(/^(Sebagai|Saya|Analisis|Berikut)[^\n]*\n*/i, '')
            .trim();

        if (!analysis || analysis.length < 30) {
            analysis = rawResponse.trim();
        }

        // Cache result
        whatIfCache.set(eventId, { text: analysis, timestamp: Date.now() });

        return analysis;

    } catch (e) {
        console.error("What-If generation error:", e.message);
        return "Analisis what-if tidak tersedia saat ini.";
    }
}

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

    return { embeds: [calendarEmbed] };
}

async function getHighImpactAlerts() {
    const events = await fetchEconomicCalendar();
    if (!events?.length) return [];

    const now = Date.now();
    const thirtyMinMs = 30 * 60 * 1000;

    const highImpactEvents = events.filter((e) => {
        if (e.type !== "event" || !e.date) return false;
        const isHigh = e.impact === "High";
        if (!isHigh) return false;

        try {
            const eventDate = new Date(e.date).getTime();
            const timeDiff = eventDate - now;
            return timeDiff > 0 && timeDiff <= thirtyMinMs;
        } catch { return false; }
    });

    // Generate alerts with What-If analysis
    const alerts = [];

    // Get macro state for What-If context (once for all events)
    let state = null;
    let regime = null;
    let regimeShiftInfo = "";
    let divergences = [];

    try {
        state = getMacroState();
        if (state && state.isHealthy) {
            regime = classifyRegime(state);
            try {
                const { getHistoricalRegime } = require("./regimeTracker");
                const prevRegime = getHistoricalRegime(1);
                if (prevRegime && prevRegime !== regime.regime) {
                    regimeShiftInfo = `\nREGIME SHIFT: ${prevRegime} → ${regime.regime}`;
                }
            } catch (e) {}
            try {
                const { detectDivergences } = require("./correlationEngine");
                divergences = detectDivergences(state);
            } catch (e) {}
        }
    } catch (e) {
        console.error("Macro state error for What-If:", e.message);
    }

    for (const e of highImpactEvents) {
        // Defensive: ensure required fields exist with fallbacks
        const country = e.country || "Global";
        const eventName = e.event || "Tidak ada nama event";
        const eventId = `${e.date}_${country}_${eventName}`;

        // Skip if already broadcasted
        if (broadcastedReleases.has(eventId)) continue;

        // Mark as broadcasted
        broadcastedReleases.add(eventId);
        if (broadcastedReleases.size > 100) {
            const iterator = broadcastedReleases.values();
            broadcastedReleases.delete(iterator.next().value);
        }

        // Generate What-If analysis for this event
        let whatIfText = "";
        if (state && state.isHealthy && regime) {
            whatIfText = await generateWhatIfForEvent(e, state, regime, regimeShiftInfo, divergences);
        }

        // Safe date formatting
        let timeWIB = "N/A";
        try {
            if (e.date) {
                timeWIB = new Date(e.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";
            }
        } catch (err) {
            console.warn(`Invalid date format for event ${eventName}:`, e.date);
        }

        // Build embed
        const embed = new EmbedBuilder()
            .setTitle(`⚠️ PERINGATAN: ${country} - ${eventName}`)
            .setColor("#e74c3c")
            .setTimestamp()
            .setFooter({ text: "Rilis dalam ≤30 menit | What-If Scenario" });

        // Main event data (with safe fallbacks)
        const forecast = e.forecast || "N/A";
        const previous = e.previous || "N/A";
        const actual = e.actual || "⌛ Menunggu rilis...";
        const impact = e.impact || "High";

        embed.addFields(
            { name: "📊 Data", value: `**${country}**: ${eventName}`, inline: false },
            { name: "⏰ Waktu Rilis", value: timeWIB, inline: true },
            { name: "📈 Dampak", value: impact, inline: true },
            { name: "🎯 Forecast", value: forecast, inline: true },
            { name: "📊 Sebelumnya", value: previous, inline: true },
            { name: "✅ Aktual", value: actual, inline: true }
        );

        // Add What-If analysis if available
        if (whatIfText) {
            // Truncate if too long for field (1024 max)
            const truncatedWhatIf = whatIfText.length > 1000
                ? whatIfText.substring(0, 997) + "..."
                : whatIfText;
            embed.addFields({ name: "🔮 What-If Scenario Analysis", value: truncatedWhatIf, inline: false });
        }

        alerts.push({ embeds: [embed] });
    }

    return alerts;
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
