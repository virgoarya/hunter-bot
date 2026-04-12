const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const { getMacroState, updateMacroData } = require("./macroData");
const { classifyRegime } = require("./regime");
const { buildBias } = require("./biasEngine");
const { detectIntent } = require("./intentEngine");
const { detectDivergences } = require("./correlationEngine");
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
    } catch (e) { }

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
        `_Data ini mingguan, diambil dari laporan resmi CFTC (deafut.txt). COT Index dari MarketBull. Gunakan untuk baca positioning, bukan intraday timing._\n\n`;

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
    const analysis = analyzeCOTChanges(cotData, getMacroState());
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
        const { postToAI } = require("../utils/aiProxy");
        const divergences = detectDivergences(state);
        const divText = divergences.length > 0 ? `
DIVERGENSI: ${divergences.join(" | ")}` : "";

        const repoData = state?.RepoData;
        const repoStr = repoData && !repoData.error ? `ON RRP: ${repoData.amountBillion}B (${repoData.direction}, ${repoData.changePercent}%)` : "ON RRP: N/A";

        // Agent 1: Rates & FX Analyst
        const ratesPrompt = `Kamu adalah Rates & FX Analyst institusional. Fokus analisis: Yield (US10Y), Dolar (DXY), Emas (GOLD).
Analisis keterkaitan antara imbal hasil obligasi AS dan valuasi mata uang/emas saat ini. Apakah pasar obligasi sedang menekan pasar FX, atau sebaliknya? Berikan 1 paragraf padat.`;
        
        const ratesData = `DXY: ${state?.DXY?.close ?? "N/A"} (${state?.DXY?.change ?? "0"})
US10Y: ${state?.US10Y?.close ?? "N/A"} (${state?.US10Y?.change ?? "0"})
GOLD: ${state?.GOLD?.close ?? "N/A"} (${state?.GOLD?.change ?? "0"})`;

        const ratesCall = postToAI([
            { role: "system", content: ratesPrompt },
            { role: "user", content: ratesData }
        ], { temperature: 0.3, max_tokens: 300 });

        // Agent 2: Liquidity & Equities Analyst
        const liquidityPrompt = `Kamu adalah Liquidity & Equities Analyst institusional. Fokus analisis: Saham (NASDAQ), Likuiditas The Fed (ON RRP), dan Volatilitas (VIX).
Analisis apakah kondisi likuiditas saat ini mendukung sentimen ambil risiko (risk-on) pada ekuitas atau justru menunjukkan pengetatan dan pelarian ke kas. Berikan 1 paragraf padat.`;

        const liquidityData = `NASDAQ: ${state?.NASDAQ?.close ?? "N/A"} (${state?.NASDAQ?.change ?? "0"})
VIX: ${state?.VIX?.close ?? "N/A"} (${state?.VIX?.change ?? "0"})
Repo/Likuiditas: ${repoStr}`;

        const liquidityCall = postToAI([
            { role: "system", content: liquidityPrompt },
            { role: "user", content: liquidityData }
        ], { temperature: 0.3, max_tokens: 300 });

        // Execute sub-agents concurrently
        const [ratesInsight, liquidityInsight] = await Promise.all([ratesCall, liquidityCall]);

        // Master Agent: Head of Macro
        const masterPrompt = `Kamu adalah "Hunter", Head of Macro di sebuah quant fund terkemuka.
Tugas Anda adalah mensintesis laporan dari tim Anda (Rates Analyst & Liquidity Analyst) menjadi sebuah Executive Summary yang tajam untuk sesi ${session.toUpperCase()}.

GAYA & FORMAT:
- Bahasa Indonesia dengan istilah trading profesional.
- Mulai dengan: "Key takeaway [Sesi ${session}]: ..."
- Paragraf 1: Ringkasan narasi makro utama (sintesis dari laporan tim).
- Paragraf 2: Implikasi & Peringatan anomali (terutama jika ada DIVERGENSI yang terdeteksi, jadikan ini fokus).
- Tutup dengan 1 kalimat: "Ini analisis edukatif, bukan saran transaksi."
- JANGAN menyebut "Menurut analis Rates" atau "Menurut analis Likuiditas". Sajikan sebagai satu kesatuan opini desk Anda.
- JANGAN menggunakan poin-poin panjang, gunakan format paragraf.`;

        const masterData = `Data Tambahan:
Regime: ${regime.regime} (${regime.description})
Intent: ${intent.intent} (${intent.description})
${divText}

Laporan Tim Rates & FX:
${ratesInsight}

Laporan Tim Likuiditas & Ekuitas:
${liquidityInsight}

Buat Executive Summary sekarang.`;

        return await postToAI([
            { role: "system", content: masterPrompt },
            { role: "user", content: masterData }
        ], { temperature: 0.4, max_tokens: 600 });

    } catch (error) {
        console.error("Outlook AI (MoE) error:", error.message);
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
