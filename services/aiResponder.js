const axios = require("axios");
const { updateMacroData, getMacroState } = require("./macroData");
const { classifyRegime } = require("./regime");
const { buildBias } = require("./biasEngine");
const { buildSessionBias } = require("./sessionBias");
const { fetchEconomicCalendar } = require("./economicCalendar");
const { fetchLiquidityFlow } = require("./liquidityFlow");
const { fetchCOTData } = require("./cotData");
const { getHistory } = require("./conversationMemory");
const { detectCorrelationPatterns } = require("./correlationEngine");
const { analyzeRateOfChange } = require("./rateOfChange");
const { detectDivergences } = require("./correlationEngine");

function isMacroStateStale(state, staleMs = 5 * 60 * 1000) {
  const updatedAt = state?.updatedAt ? new Date(state.updatedAt).getTime() : 0;
  if (!updatedAt) return true;
  return Date.now() - updatedAt > staleMs;
}

function formatCalendarItem(item) {
  const source = item?.source ? `[${item.source}] ` : "";
  let dateStr = "N/A";

  try {
    if (item?.date) {
      const d = new Date(item.date);
      dateStr = d.toLocaleString("id-ID", {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: "Asia/Jakarta"
      }) + " WIB";
    }
  } catch (e) {
    dateStr = item?.date || "N/A";
  }

  const country = item?.country || "N/A";
  const event = item?.event || "N/A";
  const actual = item?.actual ?? "?";
  const forecast = item?.forecast ?? "?";
  const previous = item?.previous ?? "?";

  if (item?.type === "news") {
    return `- ${source}[${dateStr}] ${event} | Sentiment: ${actual}`;
  }

  return `- ${source}[${dateStr}] ${country}: ${event} (Act: ${actual}, Frc: ${forecast}, Prev: ${previous})`;
}

function getSessionFlow(bias) {
  const state = getMacroState();
  const regime = classifyRegime(state);
  const intent = { intent: "N/A", description: "N/A" };
  const session = buildSessionBias(regime, bias, intent, state.RepoData);
  const hour = new Date().getUTCHours();

  let activeSession = "Asia";
  if (hour >= 7 && hour < 13) activeSession = "London";
  if (hour >= 13 && hour < 21) activeSession = "New York";

  let flowNarrative = "";
  if (activeSession === "London") {
    flowNarrative = session.londonBias;
  } else if (activeSession === "New York") {
    flowNarrative = session.newyorkBias;
  } else {
    flowNarrative = session.asiaBias;
  }

  return { activeSession, flowNarrative };
}

function buildFlowContext(flowData) {
  if (!flowData || !flowData.instruments?.length) return "";

  let context = "\nREAL-TIME LIQUIDITY FLOW:\n";

  for (const inst of flowData.instruments) {
    context += `${inst.symbol}: ${inst.price} | 4h: ${inst.change4h}% | Vol: ${inst.volumeRatio}x | ${inst.direction}`;
    if (inst.flowType !== "NORMAL") context += ` | ⚡${inst.flowType}`;
    context += "\n";
  }

  context += `USD Flow: ${flowData.usdFlow}\n`;
  context += `Risk Flow: ${flowData.riskFlow}\n`;

  if (flowData.repoData && !flowData.repoData.error) {
    context += `ON RRP / Reverse Repo Balance: $${flowData.repoData.amountBillion}B (${flowData.repoData.changePercent}%) [${flowData.repoData.direction}]\n`;
  }

  return context;
}

function buildCOTContext(cotData) {
  if (!cotData?.contracts?.length) return "";

  let context = "\nCOT POSITIONING (LATEST):\n";

  for (const contract of cotData.contracts) {
    const net = contract.speculator.net;
    context += `${contract.name}: Speculators ${net > 0 ? "+" : ""}${net.toLocaleString()} (${contract.sentiment}) | Commercial: ${contract.commercial.net > 0 ? "+" : ""}${contract.commercial.net.toLocaleString()}\n`;
  }

  return context;
}

// ========== CRITICAL THINKING ENHANCEMENTS ==========

function assessDataCompleteness(state, calendar, flowData, cotData) {
  const missing = [];
  if (!state?.DXY?.close) missing.push("DXY");
  if (!state?.NASDAQ?.close) missing.push("NASDAQ");
  if (!state?.GOLD?.close) missing.push("Gold");
  if (!state?.US10Y?.close) missing.push("US10Y");
  if (!state?.VIX?.close) missing.push("VIX");
  if (!flowData?.instruments?.length) missing.push("Liquidity Flow");
  if (!cotData?.contracts?.length) missing.push("COT Positioning");
  if (!calendar?.length) missing.push("Economic Calendar");

  const completeness = 1 - (missing.length / 7);
  const confidence = Math.max(0.3, completeness);

  return {
    missing,
    completeness: Math.round(completeness * 100),
    confidence: Math.round(confidence * 100)
  };
}

function identifyPotentialBiases(state, calendar, flowData, cotData) {
  const biases = [];

  // Recency bias check
  const today = new Date().toDateString();
  const recentEvents = calendar?.filter(e => e.date && new Date(e.date).toDateString() === today) || [];
  if (recentEvents.length > 3) {
    biases.push("RECENCY_BIAS: Multiple high-impact events today may cause over-reaction to intraday noise");
  }

  // Positioning extreme bias
  if (cotData?.contracts?.some(c => c.sentiment === "EXTREME_LONG" || c.sentiment === "EXTREME_SHORT")) {
    biases.push("POSITIONING_BIAS: Extreme COT positioning may signal crowded trades and potential reversal");
  }

  // Regime inertia bias
  try {
    const { getHistoricalRegime } = require("./regimeTracker");
    const prevRegime = getHistoricalRegime(1);
    if (prevRegime && state?.regimeData?.currentRegime !== prevRegime) {
      biases.push("REGIME_INERTIA_BIAS: Recent regime shift may cause lag in analysis adjustments");
    }
  } catch (e) {}

  // Liquidity-Flow Divergence
  if (flowData && state?.VIX?.close && parseFloat(state.VIX.close) > 20 && flowData.riskFlow === "INFLOW") {
    biases.push("LIQUIDITY-POSITION DIVERGENCE: High VIX with risk-on flow may indicate short-covering rally");
  }

  // Calendar shock clustering
  if (recentEvents.filter(e => e.impact === "High").length >= 2) {
    biases.push("EVENT_CLUSTER_BIAS: Multiple high-impact events may cause over-analysis of noise");
  }

  return biases;
}

async function buildContext(userId) {
  const currentState = getMacroState();
  if (isMacroStateStale(currentState)) {
    await updateMacroData();
  }

  const state = getMacroState();
  const regime = classifyRegime(state);
  const bias = buildBias(state, regime);
  const { activeSession, flowNarrative } = getSessionFlow(bias);

  const calendar = await fetchEconomicCalendar();

  // Fetch additional data
  let flowData = null;
  let cotData = null;
  try {
    flowData = await fetchLiquidityFlow();
  } catch (err) {
    console.error("Flow context error:", err.message);
  }

  try {
    cotData = await fetchCOTData();
  } catch (err) {
    console.error("COT context error:", err.message);
  }

  // Assess data completeness and identify biases
  const dataCompleteness = assessDataCompleteness(state, calendar, flowData, cotData);
  const biases = identifyPotentialBiases(state, calendar, flowData, cotData);

  // Build available data summary
  const availableSummary = [
    state?.DXY?.close && `DXY: ${state.DXY.close} (${state.DXY.change}%)`,
    state?.NASDAQ?.close && `NASDAQ: ${state.NASDAQ.close} (${state.NASDAQ.change}%)`,
    state?.GOLD?.close && `Gold: ${state.GOLD.close} (${state.GOLD.change}%)`,
    state?.US10Y?.close && `US10Y: ${state.US10Y.close}% (${state.US10Y.change}%)`,
    state?.VIX?.close && `VIX: ${parseFloat(state.VIX.close).toFixed(2)}`,
    calendar?.length > 0 && `Calendar: ${calendar.length} events (${calendar.filter(e => e.impact === "High").length} high impact)`,
    flowData?.instruments?.length && `Liquidity: ${flowData.usdFlow} USD flow, ${flowData.riskFlow} risk flow`,
    cotData?.contracts?.length && `COT: ${cotData.contracts.length} contracts`
  ].filter(Boolean).join("\n");

  return {
    contextHeader: "",
    dataCompleteness,
    biases,
    availableSummary,
    flowData,
    cotData,
    calendar,
    regime,
    bias,
    activeSession,
    flowNarrative,
    state
  };
}

function detectMode(question) {
  const q = question.toUpperCase();

  if (/MODE:\s*MACRO_DESK/i.test(question)) return "MACRO_DESK";
  if (/MODE:\s*POSITIONING_ENGINE/i.test(question)) return "POSITIONING_ENGINE";

  const positioningKeywords = [
    "COT", "POSITIONING", "LEVERAGED FUND", "NET LONG", "NET SHORT",
    "CROWDING", "NY SESSION", "BIAS INTRADAY", "UNWIND", "FLOW",
    "LIQUIDITY", "BISA", "SESI", "AKUMULASI", "DISTRIBUSI"
  ];

  const macroKeywords = [
    "CPI", "FOMC", "NFP", "GDP", "PPI", "SHOCK", "POLICY",
    "YIELD", "INFLASI", "INFLATION", "RATE", "FED", "MACRO",
    "KEBIJAKAN", "BANK SENTRAL", "STAGFLASI", "REFLASI"
  ];

  const posScore = positioningKeywords.filter((k) => q.includes(k)).length;
  const macScore = macroKeywords.filter((k) => q.includes(k)).length;

  if (posScore > 0 && posScore >= macScore) return "POSITIONING_ENGINE";
  if (macScore > 0) return "MACRO_DESK";

  return "GENERAL_ANALYSIS";
}

async function generateReply(question, userId) {
  try {
    const detectedMode = detectMode(question);
    const isAnalysisMode = detectedMode !== "GENERAL_ANALYSIS";

    // Build enhanced context
    const buildResult = await buildContext(null);
    const {
      contextHeader,
      dataCompleteness,
      biases,
      availableSummary,
      state,
      regime,
      bias,
      activeSession,
      flowNarrative,
      calendar,
      flowData,
      cotData
    } = buildResult;

    const correlation = detectCorrelationPatterns(state);
    const rocShocks = analyzeRateOfChange(state);
    const divergences = detectDivergences(state);

    // Calendar filtering
    const now = new Date();
    const startTime = now.getTime() - (12 * 60 * 60 * 1000);
    const endWindow = now.getTime() + (3 * 24 * 60 * 60 * 1000);

    const filteredCalendar = (calendar || []).filter(e => {
      if (!e.date) return false;
      const eventTime = new Date(e.date).getTime();
      return eventTime >= startTime && eventTime <= endWindow;
    });

    const calendarText = filteredCalendar.length > 0
      ? filteredCalendar.map(e => formatCalendarItem(e)).join("\n")
      : "No major events for the current timeframe.";

    const flowContext = flowData ? buildFlowContext(flowData) : "";
    const cotContext = cotData ? buildCOTContext(cotData) : "";

    // Detect regime shift
    let regimeShiftInfo = "";
    try {
      const { getHistoricalRegime } = require("./regimeTracker");
      const prevRegime = getHistoricalRegime(1);
      if (prevRegime && regime.regime !== prevRegime) {
        regimeShiftInfo = `\nREGIME SHIFT DETECTED: Previous: ${prevRegime} → Current: ${regime.regime}`;
      }
    } catch (e) {}

    // Build enhanced system prompt with critical thinking
    const systemPrompt = `SYSTEM DIRECTIVE: ANALISIS INSTITUSIONAL DENGAN CRITICAL THINKING

Kamu adalah Hunter, Senior Analis di Institutional Macro & Positioning Desk.
Gunakan framework pemikiran kritis untuk setiap analisis.

------------------------------------------------------------
PRINSIP DASAR:
1. Setiap argumen harus didukung oleh data spesifik (citasi: [Source: DXY 104.5]).
2. Jika data tidak tersedia, katakan jelas: "DATA TIDAK TERSEDIA".
3. JANGAN gunakan data dari training memory.
4. Berikan confidence rating (0-100%) untuk setiap kesimpulan.
5. Always provide scenario matrix (Base/Bull/Bear/Invalidation).

------------------------------------------------------------
DATA INVENTORY (Tersedia saat ini):
${availableSummary || "No data available"}

DATA MISSING: ${dataCompleteness.missing.join(", ") || "None"}
CONFIDENCE SCORE: ${dataCompleteness.confidence}% (Completeness: ${dataCompleteness.completeness}%)

POTENTIAL BIASES TO GUARD AGAINST:
${biases.map(b => `- ${b}`).join("\n") || "- None flagged"}

${regimeShiftInfo}

------------------------------------------------------------
CRITICAL THINKING PROTOCOL:

**STEP 1: DATA INVENTORY**
Identify 3-5 most relevant data points supporting the analysis.
Flag critical gaps.

**STEP 2: CONSISTENCY CHECK**
Check alignment across:
- Macro signals (DXY, US10Y, VIX)
- Positioning (COT: Specs vs Commercials)
- Liquidity Flow (USD/Risk flow, ON RRP)
- Divergences detected?
Resolve contradictions and state which source takes precedence.

**STEP 3: CONFIDENCE QUANTIFICATION**
Rate confidence 0-100% based on:
- Data completeness (current: ${dataCompleteness.completeness}%)
- Signal consistency: ___/33 pts
- Regime clarity: ___/33 pts
- Historical precedent: ___/34 pts

**STEP 4: SCENARIO MATRIX**
For any directional conclusion, specify:
- Base Case (60%+ probability)
- Bull Case (triggers: ___, probability: ___%)
- Bear Case (triggers: ___, probability: ___%)
- Invalidation Level (specific condition that voids thesis)

**STEP 5: OUTPUT STRUCTURE**
1. **Executive Summary** (1-2 sentences)
2. **Evidence-Based Analysis** (with exact data citations)
3. **Confidence**: High (>75%) / Medium (50-75%) / Low (<50%)
4. **Conflicts/Contradictions** (if any)
5. **Scenario Matrix** (Base/Bull/Bear/Invalid)
6. **Actionable Insight** (only if confidence > 70%)
7. **Data Gaps** needed to improve confidence
8. **Mandatory Disclaimer**: "Analisis bersifat kondisional. Confidence: __%. Data COT memiliki jeda mingguan."

------------------------------------------------------------
SEMUA ANALISIS HARUS MENGACU DATA 2026 DAN WAKTU WIB SAAT INI.
------------------------------------------------------------
`;

    const marketDataBlock = `
=============================
DATA PASAR REAL-TIME:
- REZIM: ${regime.regime}
- BIAS: USD ${bias.usdBias} | GOLD ${bias.goldBias} | EQUITY ${bias.equityBias}
- SESI: ${activeSession} | FLUX: ${flowNarrative}
- DIVERGENSI: ${divergences?.length > 0 ? divergences.join(" | ") : "None"}

DETAIL INSTRUMEN:
- DXY: ${state?.DXY?.close ?? "N/A"} (${state?.DXY?.change ?? "0"}%)
- NASDAQ: ${state?.NASDAQ?.close ?? "N/A"} (${state?.NASDQ?.change ?? "0"}%)
- GOLD: ${state?.GOLD?.close ?? "N/A"} (${state?.GOLD?.change ?? "0"}%)
- US10Y: ${state?.US10Y?.close ?? "N/A"}% (${state?.US10Y?.change ?? "0"}%)
- VIX: ${state?.VIX ? parseFloat(state.VIX.close).toFixed(2) : "N/A"}
${flowContext}
${cotContext}

MARKET SHOCKS (24H):
${Object.entries(rocShocks || {}).filter(([_, d]) => d.hasShock).map(([s, d]) => `• ${s}: ${d.shockType}`).join("\n") || "None"}

KALENDER EKONOMI (12h past → 3d forward):
${calendarText}
=============================
`;

    // Get conversation history
    const history = userId ? getHistory(userId) : [];
    const messages = [{ role: "system", content: systemPrompt }];

    for (const msg of history) {
      messages.push(msg);
    }

    // Construct user message with critical thinking framework
    const userMessage = `USER QUESTION: ${question}

${marketDataBlock}

---
INSTRUCTIONS:
1. Complete the Critical Thinking Protocol steps above in your analysis.
2. Use specific data citations from the marketDataBlock.
3. Quantify confidence with reasoning.
4. Provide scenario matrix for any conclusions.
5. End with: "Analisis bersifat kondisional berdasarkan data tersedia. Confidence: [X]%"

Show your reasoning process. Keep final output concise but complete.`;

    messages.push({ role: "user", content: userMessage });

    const { postToAI } = require("../utils/aiProxy");

    // Adaptive temperature: lower for high-confidence scenarios, higher for exploration
    const baseConfidence = dataCompleteness.confidence / 100;
    const temperature = isAnalysisMode
      ? (baseConfidence > 0.7 ? 0.4 : 0.65)
      : 0.7;

    const replyContent = await postToAI(messages, {
      temperature: temperature,
      max_tokens: 1200
    });

    return replyContent;
  } catch (error) {
    console.error("❌ generateReply Final Error:", error.message);
    if (error.message.includes("AI providers failed")) {
      return "⚠️ Maaf, kuota AI sedang limit. Silakan coba lagi nanti.";
    }
    return `⚠️ gangguan teknis: ${error.message.substring(0, 80)}...`;
  }
}

module.exports = { generateReply };
