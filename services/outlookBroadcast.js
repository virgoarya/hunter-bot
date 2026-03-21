const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const { getMacroState, updateMacroData } = require("./macroData");
const { classifyRegime } = require("./regime");
const { buildBias } = require("./biasEngine");
const { detectIntent } = require("./intentEngine");
const { fetchLiquidityFlow, formatFlowSummary } = require("./liquidityFlow");
const { fetchRepoData } = require("./repoService");
const { fetchCOTData, formatCOTReport } = require("./cotData");
const {
    analyzeCOTChanges,
    formatCOTAnalysis,
    generateCOTInterpretation,
    storeCOTSnapshot,
} = require("./cotAnalyzer");
const { buildCalendarBroadcast } = require("./calendarBroadcast");
const { buildTradingInsight } = require("./tradingInsight");

async function buildMorningOutlook() {
    // Refresh all data
    await updateMacroData();
    const state = getMacroState();
    const regime = classifyRegime(state);
    const bias = buildBias(state, regime);
    const intent = detectIntent(state);

    // Get date in WIB
    const now = new Date();
    const dateStr = now.toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Jakarta",
    });

    // AI-generated outlook analysis
    const aiOutlook = await generateOutlookAnalysis(state, regime, bias, intent);

    // Fetch ON RRP for morning outlook
    let repoLine = "";
    try {
        const repoData = await fetchRepoData();
        if (repoData && !repoData.error) {
            const sign = parseFloat(repoData.changePercent) > 0 ? "+" : "";
            repoLine = ` | ON RRP: **$${repoData.amountBillion}B** (${sign}${repoData.changePercent}%)`;
        }
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle(`🌅 OUTLOOK PAGI — ${dateStr}`)
        .setColor("#3498db")
        .setDescription(aiOutlook || "Analisis pasar hari ini sedang disiapkan...")
        .addFields(
            { name: "📊 Rezim Makro", value: `**${regime.regime}**\n*${regime.description}*`, inline: true },
            { name: "🧠 Niat Institusional (Intent)", value: `**${intent.intent}**\n*${intent.description}*`, inline: true }
        )
        .addFields({ name: "\u200B", value: "\u200B" }) // Spacer
        .addFields(
            { name: "💵 Bias USD", value: bias.usdBias, inline: true },
            { name: "🥇 Bias Emas", value: bias.goldBias, inline: true },
            { name: "📉 Bias Saham", value: bias.equityBias, inline: true }
        )
        .addFields({ name: "\u200B", value: "\u200B" }) // Spacer
        .addFields(
            {
                name: "📈 Level Kunci",
                value: `DXY: **${state?.DXY?.close ?? "N/A"}** | ` +
                    `GOLD: **${state?.GOLD?.close ?? "N/A"}** | ` +
                    `NASDAQ: **${state?.NASDAQ?.close ?? "N/A"}** | ` +
                    `US10Y: **${state?.US10Y?.close ?? "N/A"}%** | ` +
                    `VIX: **${state?.VIX?.close ?? "N/A"}**` + repoLine,
                inline: false
            }
        )
        .setTimestamp()
        .setFooter({ text: "Hunter Bot • Analisa Pagi" });

    // Generate trading insight
    const repoData = state.RepoData;
    const insight = buildTradingInsight(regime, bias, intent, repoData);
    embed.addFields({ name: "\u200B", value: "\u200B" });
    embed.addFields({ name: "🎯 INSIGHT POSISI TRADING", value: insight.text, inline: false });

    return { embeds: [embed] };
}

async function buildSessionOutlook(sessionName) {
    // Ensure we have fresh data for the session
    await updateMacroData();
    const state = getMacroState();
    const regime = classifyRegime(state);
    const bias = buildBias(state, regime);
    const intent = detectIntent(state);

    const emoji =
        sessionName === "London"
            ? "🌍"
            : sessionName === "New York"
                ? "🇺🇸"
                : "🌏";

    // AI-generated outlook analysis for the specific session
    const aiOutlook = await generateOutlookAnalysis(state, regime, bias, intent, sessionName);

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} OUTLOOK SESI ${sessionName.toUpperCase()}`)
        .setColor(sessionName === "London" ? "#3498db" : "#9b59b6")
        .setDescription(aiOutlook || `Analisis sesi ${sessionName} sedang disiapkan...`)
        .addFields(
            { name: "📊 Rezim Makro", value: `**${regime.regime}**\n*${regime.description}*`, inline: true },
            { name: "🧠 Niat Institusional", value: `**${intent.intent}**\n*${intent.description}*`, inline: true }
        )
        .addFields({ name: "\u200B", value: "\u200B" }) // Spacer
        .addFields(
            { name: "💵 Bias USD", value: bias.usdBias, inline: true },
            { name: "🥇 Bias Emas", value: bias.goldBias, inline: true },
            { name: "📉 Bias Saham", value: bias.equityBias, inline: true }
        );

    // Fetch real-time flow for the session
    let flowText = "";
    try {
        const flowData = await fetchLiquidityFlow();
        if (flowData) {
            flowText = formatFlowSummary(flowData);
        }
    } catch (err) {
        console.error("Session flow fetch error:", err.message);
    }

    if (flowText) {
        embed.addFields({ name: "💧 Aliran Likuiditas", value: flowText, inline: false });
    }

    embed.addFields({ name: "\u200B", value: "\u200B" }) // Spacer
    embed.addFields(
        {
            name: "📈 Level Kunci",
            value: `DXY: **${state?.DXY?.close ?? "N/A"}** | ` +
                `GOLD: **${state?.GOLD?.close ?? "N/A"}** | ` +
                `NASDAQ: **${state?.NASDAQ?.close ?? "N/A"}** | ` +
                `US10Y: **${state?.US10Y?.close ?? "N/A"}%** | ` +
                `VIX: **${state?.VIX?.close ?? "N/A"}**`,
            inline: false
        }
    );

    embed.setTimestamp().setFooter({ text: `Hunter Bot • Desk Sesi ${sessionName}` });

    // Generate trading insight
    const insightData = buildTradingInsight(regime, bias, intent, state.RepoData);
    embed.addFields({ name: "\u200B", value: "\u200B" });
    embed.addFields({ name: "🎯 INSIGHT POSISI TRADING", value: insightData.text, inline: false });

    return { embeds: [embed] };
}

async function buildCOTBroadcast() {
    // Ensure we have fresh macro data for context
    const macroState = getMacroState();
    if (!macroState.isHealthy) {
        await updateMacroData();
    }

    const cotData = await fetchCOTData(true);
    if (!cotData) return null;

    storeCOTSnapshot(cotData);

    const embed = new EmbedBuilder()
        .setTitle("📊 LAPORAN COT — COMMITMENT OF TRADERS")
        .setColor("#2ecc71")
        .setTimestamp();

    let description = `**Tanggal Laporan (CFTC):** ${cotData.reportDate}\n` +
                      `_Data ini mingguan, diambil dari laporan resmi CFTC (deafut.txt). Gunakan untuk baca positioning, bukan intraday timing._\n\n`;

    // Contracts - Split by category
    const forex = cotData.contracts.filter(c => c.category === "forex");
    const others = cotData.contracts.filter(c => c.category !== "forex");

    const buildList = (list) => {
        let text = "";
        for (const c of list) {
            let line = `**${c.name}**: ${c.sentiment} (Net: ${c.speculator.net.toLocaleString()})`;
            if (c.marketBull && c.marketBull.cotIndex6M !== "N/A") {
                line += `\n   ┗ 📊 **Index: ${c.marketBull.cotIndex6M}** | [Chart](${c.marketBull.chartUrl})`;
            }
            text += line + "\n";
        }
        return text || "Tidak ada data";
    };

    embed.addFields(
        { name: "📝 Recap Positioning (Currencies)", value: buildList(forex), inline: false },
        { name: "📝 Recap Positioning (Commodities & Indices)", value: buildList(others), inline: false }
    );

    // Meta info in description
    embed.setDescription(description);

    // Analysis/Interpretation (optional, but keep it if AI is fast)
    const analysis = analyzeCOTChanges(cotData);
    if (analysis) {
        const interpretation = await generateCOTInterpretation(cotData, analysis);
        if (interpretation) {
    if (analysis) {
        const interpretation = await generateCOTInterpretation(cotData, analysis);
        if (interpretation) {
            // Smart split: Split by sections or sentences to avoid mid-word cuts
            const sections = interpretation.split(/\n(?=🔍|🧠|🎯)/g); // Split by icons
            
            for (let section of sections) {
                // If a section is still > 1024, split by sentence
                const chunks = section.match(/[\s\S]{1,1024}(?:\.|\n|$)/g) || [section];
                chunks.forEach((chunk, index) => {
                    if (chunk.trim()) {
                        embed.addFields({ 
                            name: index === 0 && section.startsWith("🔍") ? "🔍 Analisis Posisi CTA" : 
                                  index === 0 && section.startsWith("🧠") ? "🧠 Macro Reasoning" :
                                  index === 0 && section.startsWith("🎯") ? "🎯 Smart Money Insight" : "\u200B", 
                            value: chunk.substring(0, 1024), 
                            inline: false 
                        });
                    }
                });
            }
        }
    }
        }
    }

    return { embeds: [embed] };
}

async function generateOutlookAnalysis(state, regime, bias, intent, session = "pagi") {
    try {
        const systemPrompt = `
Kamu adalah "Hunter", analis institutional desk profesional untuk komunitas trading Indonesia.

TUGAS:
- Jelaskan kondisi pasar berdasarkan DATA yang diberikan di input user: rezim makro, bias USD/emas/saham, intent institusional, dan level indeks yang sudah dihitung bot.
- Anda sedang menganalisis sesi: ${session.toUpperCase()}. Jelaskan karakteristik sesi ini (misal: volume London, volatilitas NY) dalam konteks data tersebut.
- Fokus ke narasi: tekanan sistem, arah likuiditas, dan apa yang perlu dipantau hari ini.
- JANGAN menambahkan angka baru (harga, yield, indeks, level teknikal) di luar yang tertulis di input.
- Jika ingin menyebut angka, gunakan hanya angka yang sudah ada di input user, atau sebut secara kualitatif (misalnya: "tinggi", "rendah", "naik", "turun").
- Jangan mengklaim sumber data seperti Bloomberg, Reuters, dsb. Anggap semua data hanya berasal dari input.

GAYA:
- Bahasa Indonesia dengan istilah teknis Inggris.
- 2–3 paragraf pendek, padat, gaya desk briefing.
- Mulai dengan kalimat: "Key takeaway [Sesi ${session}]: ..."
- Tutup dengan 1 kalimat: "Ini analisis edukatif, bukan saran transaksi."`;

        const userContent = `
Data rezim & bias:
- Regime: ${regime.regime} (${regime.description})
- Intent: ${intent.intent} (${intent.description})
- Bias USD: ${bias.usdBias}
- Bias Emas: ${bias.goldBias}
- Bias Saham: ${bias.equityBias}

Level kunci (boleh disebut secara kualitatif, jangan tambah angka baru):
- DXY: ${state?.DXY?.close ?? "N/A"}
- GOLD: ${state?.GOLD?.close ?? "N/A"}
- NASDAQ: ${state?.NASDAQ?.close ?? "N/A"}
- US10Y: ${state?.US10Y?.close ?? "N/A"}
- VIX: ${state?.VIX?.close ?? "N/A"}

Instruksi:
- Jelaskan arah likuiditas (dolar, yield, risk sentiment) berdasarkan data di atas.
- Jika data ON RRP tersedia, integrasikan analisisnya: apakah institusi memarkir uang di The Fed (risk-off) atau menariknya kembali ke pasar (risk-on).
- Jelaskan implikasi praktis untuk trader intraday/swing (tanpa rekomendasi spesifik entry/SL).
- Jelaskan apa yang paling perlu dipantau hari ini (data, level, atau reaksi pasar), secara naratif saja.`;

        const { postToAI } = require("../utils/aiProxy");
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
        ];

        return await postToAI(messages, {
            temperature: 0.3
        });
    } catch (error) {
        console.error("Outlook AI error:", error.message);
        return null;
    }
}

async function sendOutlookBroadcast(client, type = "morning") {
    const channelId = process.env.MACRO_CHANNEL_ID;
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

    let payload;

    switch (type) {
        case "morning":
            payload = await buildMorningOutlook();
            break;
        case "london":
            payload = await buildSessionOutlook("London");
            break;
        case "newyork":
            payload = await buildSessionOutlook("New York");
            break;
        case "cot":
            payload = await buildCOTBroadcast();
            break;
        default:
            payload = await buildMorningOutlook();
    }

    if (!payload) {
        console.log(`No ${type} outlook data to broadcast`);
        return;
    }

    await channel.send(payload);
    console.log(`📤 ${type} outlook broadcast sent`);
}

module.exports = {
    sendOutlookBroadcast,
    buildMorningOutlook,
    buildSessionOutlook,
    buildCOTBroadcast
};
