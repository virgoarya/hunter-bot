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

            // Cari event paling penting HARI INI (WIB) - untuk What-If yang fokus dan relevan
            const todayWib = new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
            const todayEvents = events.filter(e => {
                if (!e.date || e.impact !== "High" || e.event.toLowerCase().includes("holiday")) return false;
                try {
                    const eventDate = new Date(e.date);
                    const eventDateWib = eventDate.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
                    return eventDateWib === todayWib;
                } catch {
                    return false;
                }
            }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by time ascending

            // Ambil maksimal 2 event paling penting hari ini
            const topEvents = todayEvents.slice(0, 2);

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

**1. KUALIFIKASI BEAT/MISS/IN-LINE**
Untuk SETIAP event:
-Estimasi magnitudo dampak (berdasarkan avg dampak historis): DXY ±X bps, Gold ±Y$, dll.
- Jika BEAT > forecast dengan >0.5% untuk CPI/NFP, expect reaksi langsung.
- Jika MISS > forecast dengan >0.5%, reaksi sebaliknya.
- Jika in-line, reaksi minimal (sering fade).

**2. CHAIN CAUSE-EFFECT (WAJIB JELASKAN)**
Jangan hanya bilang "DXY menguat". Jelaskan MENGAPA:
Contoh: "Higher CPI → Ekspektasi Fed hawkish ↑ → Permintaan USD ↑ → DXY +0.5% dalam 1 jam"

**3. KONTEKS REGIME**
- Bagaimana regime saat ini (${regime.regime}) mempengaruhi reaksi?
- Contoh: Dalam regime RISK-OFF, data positif pun bisa dianggap "buruk" (karena manterkan Fed hawkish → hurts equities).
- Contoh: Dalam regime INFLASI, data panas apapun menguatkan narasi "Tighter-for-Longer".

**4. DAMPAK REGIME SHIFT**${regimeShiftInfo ? '- Pasar sedang transisi regimes, interpretasi data berubah. Jelaskan lensa OLD vs NEW.' : ''}

**5. PERTIMBANGAN DIVERGENSI**${divText ? '- Smart money mungkin sudah position. Divergensi menandakan potensi squeeze/reversal.' : ''}

**6. TIMEFRAME & POTENSI FADE**
- Intraday (2-4 jam): Reaksi algo awal, mungkin fade jika data sudah priced-in.
- Short-term (1-3 hari): Gerakan berkelanjutan jika data ubah narasi Fed/inflasi.
- Structural (>1 minggu): Langka, butuh regime change atau policy shift.
- Risiko fade: Jika deviasi kecil (<0.3%) → likely sudah priced.

**7. CONFIDENCE & TRIGGER**
- Confidence: High (>75%) / Medium (50-75%) / Low (<50%)
- Key trigger level: "Jika CPI > 3.5%, DXY +0.8% dalam 2 jam"
- Invalidation: "Jika Core CPI < 3.0%, thesis wrong"

## OUTPUT FORMAT:

**WHAT-IF SCENARIO ANALYSIS**

[Nama Event 1]:
BEAT/MISS: [ ] dengan deviasi [X]%
Dampak instan: DXY ±X bps, Gold ±Y$, Nasdaq ±Z$
Mechanism: (Jelaskan cause-effect chain dalam 1-2 kalimat)
Regime filter: (Bagaimana regime ${regime.regime} memodifikasi reaksi?)
Timeframe: [intraday / short-term / structural]
Confidence: [High/Med/Low] - alasan singkat
Key trigger: "[Condition spesifik]"
Invalidation: "[Condition sebaliknya]"

[Nama Event 2]: (struktur sama)
[...]

**CONSOLIDATED BIAS MINGGU INI:**
Berdasarkan dampak gabungan event:
- Risk-On / Risk-Off / Neutral
- DXY bias: [Long/Short/Neutral]
- Gold bias: [Long/Short/Neutral]
- Catatan reversal/fade conditions yang diharapkan.

## ATURAN:
- Gunakan angka spesifik dari konteks (DXY 104.5, bukan "DXY saat ini").
- Jangan Meredith data yang diberikan.
- Jangan mulai dengan "Sebagai Senior Macro Analyst..." - langsung ke analisis.
- Output harus lengkap namun padat, including semua key elements.

CATATAN PENTING: Seluruh analisis harus dalam BAHASA INDONESIA. Hindari kata-kata bahasa Inggris seperti "beat", "miss", "fade", "trigger". Gunakan terjemahan Indonesia yang tepat.

CONTOH TERJEMAHAN:
- BEAT → "lebih tinggi dari forecast" / "kebelokan"
- MISS → "lebih rendah dari forecast" / "lembek"
- IN-LINE → "sesuai forecast" / "inline"
- FADE → "lemah" / "tidak bertahan"
- TRIGGER → "pemicu" / "level kunci"
- LONG → "long" / "beli"
- SHORT → "short" / "jual"

Output your entire analysis in Indonesian. Do NOT use English sentences.
`;

                const systemContent = `Kamu adalah Senior Macro Analyst di Institutional Desk yang memberikan analisis What-If scenario dengan critical thinking framework.

**BAHASA: OUTPUT HARUS 100% BAHASA INDONESIA**
- JANGAN gunakan kalimat bahasa Inggris.
- Istilah teknis (DXY, US10Y, Gold, Nasdaq) boleh di-spell, tapi penjelasan harus Indonesia.
- Contoh: "DXY akan menguat 0.5%" (BENAR), bukan "DXY will strengthen 0.5%" (SALAH).

**PRINSIP ANALISIS:**
1. KUANTITATIF: Berikan perkiraan dampak numerik (DXY ±X bps, Gold ±Y$, Nasdaq ±Z%).
2. MEKANISME: Jelaskan alur sebab-akibat (WHY reaksi terjadi).
3. REGIME-AWARE: Interpretasi Bergantung pada rezim pasar saat ini.
4. UNCERTAINTY: Berikan Confidence rating (High/Med/Low) + kondisi invalidasi.
5. PRECISI: Gunakan data spesifik dari konteks, jangan approximate.

Output HANYA berisi analisis sesuai format di atas. Tidak pengenalan/sambutan. Langsung ke "ANALISIS WHAT-IF SCENARIO".

**CONTOH OUTPUT BAHAWA:**
Hal ini termasuk DXY +0.8% karena data CPI lebih tinggi dari forecast, meningkatkan ekspektasi Fed hawkish. Dalam regime INFLASI, ini плохой untuk equities. Confidence: High (80%).
`;

                const messages = [
                    { role: "system", content: systemContent },
                    { role: "user", content: prompt }
                ];
                const rawResponse = await postToAI(messages, { temperature: 0.5, max_tokens: 800 });

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
                // Check if there are high-impact events in the next 3 days but none today
                const upcomingHighImpact = events.filter(e => e.impact === "High" && e.event && !e.event.toLowerCase().includes("holiday"));
                if (upcomingHighImpact.length > 0) {
                    whatIfScenario = "Hari ini tidak ada event high-impact yang dijadwalkan rilis. What-If scenario akan diaktifkan kembali ketika ada event penting hari ini.";
                } else {
                    whatIfScenario = "Tidak ada event high-impact dalam 3 hari ke depan. Monitor kalender untuk update.";
                }
            }
        } catch (e) {
            console.error("What-If AI Error:", e.message);
            whatIfScenario = "Skenario AI tidak tersedia saat ini.";
        }
    }

    // Truncate if needed for Discord embed description limit (4096 chars)
    // With max_tokens 800, expected length ~3000-3800 chars, safe guard at 3800
    let scenarioDisplay = whatIfScenario;
    const originalLength = scenarioDisplay?.length || 0;
    if (scenarioDisplay && scenarioDisplay.length > 3800) {
        scenarioDisplay = scenarioDisplay.substring(0, 3797) + "...";
        console.log(`⚠️ What-If scenario truncated from ${originalLength} to ${scenarioDisplay.length} chars`);
    } else if (scenarioDisplay && scenarioDisplay.length > 3000) {
        console.log(`📏 What-If scenario length: ${scenarioDisplay.length} chars`);
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
