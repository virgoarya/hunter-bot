const { EmbedBuilder } = require("discord.js");
const { fetchEconomicCalendar } = require("./economicCalendar");
const { generateCalendarInterpretation } = require("./calendarAnalyzer");

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

    const embed = new EmbedBuilder()
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
                timeStr = eventDate.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jakarta",
                });
            } catch { timeStr = "Check" }

            return { ...e, impactEmoji, timeWIB: timeStr };
        });

        // Filter: ONLY High Impact
        const highImpact = formatted.filter(e => e.impact === "High" || e.event.toLowerCase().includes("holiday"));

        if (highImpact.length === 0) {
            dayText = "_Tidak ada berita berdampak tinggi_";
        } else {
            highImpact.forEach(e => {
                const source = e.source ? `[${e.source}] ` : "";
                const row = `${e.impactEmoji} \`${e.timeWIB}\` ${source}**${e.country}**: ${e.event} (\`${e.actual || "N/A"}\`/\`${e.forecast || "N/A"}\`/\`${e.previous || "N/A"}\`)\n`;
                
                if ((dayText + row).length < 1010) {
                    dayText += row;
                }
            });
        }

        embed.addFields({ name: `🗓️ ${dateKey.toUpperCase()}`, value: dayText || "_Tidak ada_", inline: false });
    }

    return { embeds: [embed] };
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
            embed.addFields({ name: "🧠 Catatan Cepat Sektor Institusional", value: interpretation, inline: false });
        }

        alerts.push({ embeds: [embed] });
    }

    return alerts;
}

module.exports = { buildCalendarBroadcast, getHighImpactAlerts, getNewReleaseAlerts };
