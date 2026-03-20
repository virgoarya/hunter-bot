const { EmbedBuilder } = require("discord.js");
const { fetchYahooPrice } = require("./yahooFinance");

const CACHE_MS = 2 * 60 * 1000; // 2 minutes cache
let flowCache = { data: null, updatedAt: 0 };

const FLOW_INSTRUMENTS = [
  { symbol: "EUR/USD", alias: "EUR/USD", type: "forex" },
  { symbol: "GBP/USD", alias: "GBP/USD", type: "forex" },
  { symbol: "USD/JPY", alias: "USD/JPY", type: "forex" },
  { symbol: "GOLD", alias: "GOLD", type: "commodity" },
  { symbol: "DXY", alias: "DXY", type: "index" },
  { symbol: "NASDAQ", alias: "NASDAQ", type: "index" },
];

async function fetchLiquidityFlow(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && flowCache.data && now - flowCache.updatedAt < CACHE_MS) {
    return flowCache.data;
  }

  const results = [];

  for (const instrument of FLOW_INSTRUMENTS) {
    try {
      const data = await fetchYahooPrice(instrument.symbol);

      if (data && data.close) {
        const changeNum = parseFloat(data.change) || 0;
        let direction = "SIDEWAYS";
        if (changeNum > 0.15) direction = "BULLISH";
        else if (changeNum < -0.15) direction = "BEARISH";

        results.push({
          symbol: instrument.alias,
          type: instrument.type,
          price: data.close,
          change1h: "N/A",
          change4h: (changeNum / 6).toFixed(3),
          change24h: data.change,
          volumeRatio: "1.00",
          direction,
          flowType: "NORMAL",
        });
      }
    } catch (error) {
      console.error(
        `Flow fetch error for ${instrument.alias}:`,
        error.message
      );
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (results.length === 0) {
    return { error: "Semua sumber data gagal.", instruments: [] };
  }

  // Aggregate flow analysis
  const usdFlow = calculateUSDFlow(results);
  const riskFlow = calculateRiskFlow(results);

  const flowData = {
    instruments: results,
    usdFlow,
    riskFlow,
    updatedAt: new Date().toISOString(),
  };

  flowCache = { data: flowData, updatedAt: now };
  return flowData;
}

function calculateUSDFlow(instruments) {
  const eurUsd = instruments.find((i) => i.symbol === "EUR/USD");
  const gbpUsd = instruments.find((i) => i.symbol === "GBP/USD");
  const usdJpy = instruments.find((i) => i.symbol === "USD/JPY");
  const dxy = instruments.find((i) => i.symbol === "DXY");

  let usdDemand = 0;
  if (eurUsd && parseFloat(eurUsd.change24h) < 0) usdDemand++;
  if (gbpUsd && parseFloat(gbpUsd.change24h) < 0) usdDemand++;
  if (usdJpy && parseFloat(usdJpy.change24h) > 0) usdDemand++;
  if (dxy && parseFloat(dxy.change24h) > 0) usdDemand++;

  if (usdDemand >= 3) return "PERMINTAAN_USD_KUAT";
  if (usdDemand >= 2) return "PERMINTAAN_USD_RINGAN";
  if (usdDemand <= 1) return "USD_DITAWARKAN";
  return "NETRAL";
}

function calculateRiskFlow(instruments) {
  const nasdaq = instruments.find((i) => i.symbol === "NASDAQ");
  const gold = instruments.find((i) => i.symbol === "GOLD");

  if (!nasdaq && !gold) return "DATA_TIDAK_CUKUP";

  const nasdaqDir = nasdaq?.direction || "SIDEWAYS";
  const goldDir = gold?.direction || "SIDEWAYS";

  if (nasdaqDir === "BULLISH" && goldDir !== "BULLISH") return "EKSPANSI_RISIKO";
  if (nasdaqDir === "BEARISH" && goldDir === "BULLISH") return "DE_RISKING";
  if (goldDir === "BULLISH" && nasdaqDir === "BEARISH") return "DEFENSIF";
  return "ROTASI";
}

function formatFlowSummary(flowData) {
  if (flowData && flowData.error) {
    return `⚠️ **Data Error:** ${flowData.error}`;
  }
  if (!flowData || !flowData.instruments?.length) {
    return "Data aliran likuiditas tidak tersedia.";
  }

  let summary = "📊 **ALIRAN LIKUIDITAS REAL-TIME**\n\n";

  for (const inst of flowData.instruments) {
    const arrow =
      inst.direction === "BULLISH"
        ? "🟢"
        : inst.direction === "BEARISH"
          ? "🔴"
          : "⚪";
    const flowTag =
      inst.flowType !== "NORMAL" ? ` | ⚡ ${inst.flowType}` : "";
    summary += `${arrow} **${inst.symbol}**: ${inst.price} (24h: ${inst.change24h}%)${flowTag}\n`;
  }

  summary += `\n💵 **Aliran USD**: ${flowData.usdFlow.replace(/_/g, " ")}`;
  summary += `\n📈 **Aliran Risiko**: ${flowData.riskFlow.replace(/_/g, " ")}`;

  return summary;
}

function buildFlowEmbed(flowData) {
  if (flowData && flowData.error) {
    return { content: `⚠️ **Data Error:** ${flowData.error}` };
  }
  if (!flowData || !flowData.instruments?.length) {
    return { content: "Data aliran likuiditas tidak tersedia." };
  }

  const embed = new EmbedBuilder()
    .setTitle("💧 ALIRAN LIKUIDITAS REAL-TIME")
    .setColor("#3498db")
    .setTimestamp()
    .setFooter({ text: "Hunter Bot • Flow Desk" });

  let instrumentList = "";
  for (const inst of flowData.instruments) {
    const arrow =
      inst.direction === "BULLISH"
        ? "🟢"
        : inst.direction === "BEARISH"
          ? "🔴"
          : "⚪";
    instrumentList += `${arrow} **${inst.symbol}**: ${inst.price} (${inst.change24h}%)\n`;
  }

  embed.addFields(
    { name: "📈 Instrumen", value: instrumentList || "Tidak ada data", inline: false },
    { name: "💵 Aliran USD", value: `**${flowData.usdFlow.replace(/_/g, " ")}**`, inline: true },
    { name: "🎲 Aliran Risiko", value: `**${flowData.riskFlow.replace(/_/g, " ")}**`, inline: true }
  );

  return { embeds: [embed] };
}

module.exports = { fetchLiquidityFlow, formatFlowSummary, buildFlowEmbed };
