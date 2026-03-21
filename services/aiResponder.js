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
  const calendarText = calendar.length > 0
    ? calendar.map((e) => formatCalendarItem(e)).join("\n")
    : "No major upcoming events found.";

  // Fetch additional context (non-blocking, with fallbacks)
  let flowContext = "";
  let cotContext = "";

  try {
    const flowData = await fetchLiquidityFlow();
    flowContext = buildFlowContext(flowData);
  } catch (err) {
    console.error("Flow context error:", err.message);
  }

  try {
    const cotData = await fetchCOTData();
    cotContext = buildCOTContext(cotData);
  } catch (err) {
    console.error("COT context error:", err.message);
  }

  // Get conversation history for this user
  const history = userId ? getHistory(userId) : [];
  const historyContext = history.length > 0
    ? "\nCONVERSATION HISTORY:\n" +
    history.map((m) => `${m.role}: ${m.content}`).join("\n") +
    "\n"
    : "";

  return `SYSTEM DIRECTIVE: ANALISIS INSTITUTIONAL DESK
    
Kamu adalah Hunter, Senior Analis di Institutional Macro & Positioning Desk.
Tugas kamu adalah memberikan analisis pasar yang tajam, profesional, dan berbasis data makro yang tersedia.

------------------------------------------------------------
PRINSIP ANALISIS (WAJIB DIPATUHI)

1. GAYA BAHASA:
   - Gunakan Bahasa Indonesia yang profesional dan natural (tidak kaku seperti robot).
   - Gunakan istilah teknis keuangan internasional (English) jika diperlukan untuk presisi (misal: Liquidity Flow, Real Yields, Crowding, Unwind).
   - Hindari dramatisasi berlebihan atau narasi "halu". Setiap argumen harus didukung oleh data di bawah.

2. DISIPLIN DATA:
   - JANGAN membuat data atau angka yang tidak ada dalam konteks input.
   - Jika data kunci tidak tersedia, nyatakan secara transparan: "Data [X] saat ini belum tersedia untuk analisis lengkap."
   - Hubungkan titik-titik data (Korelasi): Jelaskan MENGAPA data makro tertentu mempengaruhi aset yang ditanyakan (Sebab-Akibat).
   - PRIORITASKAN DATA AKTUAL (Act): Jika dalam Kalender Ekonomi sebuah event hari ini sudah memiliki nilai "Act" (bukan ? atau N/A), gunakan angka tersebut sebagai fakta utama dalam analisis Anda.

3. PENENTUAN MODE:
   - MODE: MACRO_DESK -> Digunakan untuk analisis fundamental/kebijakan bank sentral/kejutan ekonomi.
   - MODE: POSITIONING_ENGINE -> Digunakan untuk analisis COT, aliran likuiditas sesi, dan bias intraday.
   - Jika tidak ada instruksi khusus, pilih mode yang paling relevan secara otomatis.

4. PROTOKOL KEJUJURAN & ANTI-HALUSINASI (SANGAT KETAT):
   - JANGAN PERNAH MENGGUNAKAN HARGA ATAU DATA DARI MEMORI PELATIHAN (TRAINING DATA). 
   - JIKA DATA TIDAK ADA DI BAGIAN "DATA PASAR REAL-TIME", ANDA WAJIB MENYATAKAN "DATA TIDAK TERSEDIA".
   - JANGAN PERNAH MENCANTUMKAN SUMBER SPESIFIK (seperti Bloomberg, NYMEX, ICE, Reuters) kecuali sumber tersebut secara eksplisit disebutkan dalam data pasar yang diberikan di bawah.
   - JANGAN PERNAH mengarang angka historis yang presisi (misalnya harga 1 minggu lalu atau persen perubahan YTD) jika data tersebut tidak diberikan. Gunakan frasa kualitatif atau nyatakan data tidak tersedia.
   - JANGAN PERNAH memberikan angka desimal yang berlebihan untuk VIX (maksimal 2 desimal).
   - JANGAN memberikan instruksi "Position Sizing" atau "Leverage" dalam angka absolut (misal: "Gunakan leverage 2.29x"). Berikan konsep manajemen risiko kualitatif saja.
   - Jika menghitung metrik seperti Sharpe Ratio tanpa data time-series lengkap, Anda WAJIB menyatakan bahwa itu adalah "Simulasi/Estimasi Ilustratif" dan bukan hasil perhitungan historis aktual.

5. KHUSUS UNTUK PERINTAH /cot ATAU "COT report":
   - Meskipun data yang diberikan di input berasal dari CFTC, hindari kesan "hyper-precision" yang tidak perlu.
   - JANGAN pernah menulis tanggal laporan spesifik (seperti 2026-03-03) kecuali tanggal tersebut ada di data pasar input.
   - Fokus pada interpretasi kualitatif: net long besar/kecil, crowded atau tidak, arah aliran (add/unwind).
   - Gunakan kata-kata seperti "signifikan", "moderat", "relatif tinggi", alih-alih hanya terpaku pada angka kontrak.
   - JANGAN pernah mengklaim data tersebut real-time (karena COT dirilis mingguan).

------------------------------------------------------------
KONTEKS WAKTU:
- TANGGAL SEKARANG: ${new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' })} (WIB)
- WAKTU SEKARANG: ${new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB
- SEMUA ANALISIS HARUS MENGACU PADA REALITAS TAHUN 2026 BERDASARKAN DATA YANG DIBERIKAN.

------------------------------------------------------------
STRUKTUR OUTPUT UMUM:

- Identifikasi Rezim Makro & Niat Institusi (Institutional Intent).
- Analisis Tekanan (Pressure Point) berdasarkan data terbaru.
- Kesimpulan Strategis / Bias Sesi.
- Batas Invalidation (Logika kenapa analisis ini bisa salah).

Selalu akhiri analisis dengan: "Analisis bersifat kondisional berdasarkan data yang tersedia secara real-time. Data COT mungkin memiliki jeda waktu karena siklus rilis mingguan CFTC."
------------------------------------------------------------
    `;
}

/**
 * Auto-detect which MODE applies based on user message keywords.
 */
function detectMode(question) {
  const q = question.toUpperCase();

  // Explicit MODE always wins
  if (/MODE:\s*MACRO_DESK/i.test(question)) return "MACRO_DESK";
  if (/MODE:\s*POSITIONING_ENGINE/i.test(question)) return "POSITIONING_ENGINE";

  // POSITIONING_ENGINE keywords
  const positioningKeywords = [
    "COT", "POSITIONING", "LEVERAGED FUND", "NET LONG", "NET SHORT",
    "CROWDING", "NY SESSION", "BIAS INTRADAY", "UNWIND", "FLOW",
    "LIQUIDITY", "BISA", "SESI", "AKUMULASI", "DISTRIBUSI"
  ];

  // MACRO_DESK keywords
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

    // Build core context data
    const contextHeader = await buildContext(null); // System instructions

    // Get actual market data
    const state = getMacroState();
    const regime = classifyRegime(state);
    const bias = buildBias(state, regime);
    const { activeSession, flowNarrative } = getSessionFlow(bias);
    const correlation = detectCorrelationPatterns(state);
    const rocShocks = analyzeRateOfChange(state);
    const calendar = await fetchEconomicCalendar();
    
    // Filter calendar: Include last 12 hours + future events up to 3 days
    // This ensures AI can see and comment on recently released data
    const now = new Date();
    const startTime = now.getTime() - (12 * 60 * 60 * 1000); // 12 hours ago
    const endWindow = now.getTime() + (3 * 24 * 60 * 60 * 1000); // 3 days ahead
    
    const filteredCalendar = calendar.filter(e => {
      if (!e.date) return false;
      const eventTime = new Date(e.date).getTime();
      return eventTime >= startTime && eventTime <= endWindow;
    });

    const calendarText = filteredCalendar.length > 0
      ? filteredCalendar.map(e => formatCalendarItem(e)).join("\n")
      : "No major events for the current timeframe.";

    // Additional data flows
    let flowContext = "";
    try {
      const flowData = await fetchLiquidityFlow();
      flowContext = buildFlowContext(flowData);
    } catch (e) { }

    let cotContext = "";
    try {
      const cotData = await fetchCOTData();
      cotContext = buildCOTContext(cotData);
    } catch (e) { }

    const marketDataBlock = `
=============================
DATA PASAR REAL-TIME:
- REZIM: ${regime.regime} (${regime.description})
- BIAS USD: ${bias.usdBias} | EMAS: ${bias.goldBias} | SAHAM: ${bias.equityBias}
- KORELASI: ${correlation?.signal || "NETRAL"} (${correlation?.description || "N/A"})
- SESI AKTIF: ${activeSession} | NARASI FLUX: ${flowNarrative}

DETAIL INSTRUMEN:
- DXY: ${state?.DXY?.close ?? "N/A"}
- NASDAQ (Yield adjusted): ${state?.NASDAQ?.close ?? "N/A"}
- XAU/USD (Gold): ${state?.GOLD?.close ?? "N/A"}
- WTI OIL: ${state?.OIL?.close ?? "N/A"}
- US10Y: ${state?.US10Y?.close ?? "N/A"}%
- FED FUNDS RATE (FFR): ${state?.FFR?.close ?? "N/A"}%
- VIX: ${state?.VIX ? parseFloat(state.VIX.close).toFixed(2) : "N/A"}
${flowContext}
${cotContext}

MARKET SHOCKS (24H MOMENTUM):
${Object.entries(rocShocks || {}).filter(([_, d]) => d.hasShock).map(([s, d]) => `• ${s}: ${d.shockType}`).join("\n") || "No immediate shocks detected."}

KALENDER EKONOMI TERBARU:
${calendarText}
=============================
`;

    const instructions = `${contextHeader}\nMODE SAAT INI: ${detectedMode}\n${marketDataBlock}`;

    // Get conversation history
    const history = userId ? getHistory(userId) : [];
    const messages = [{ role: "system", content: instructions }];

    for (const msg of history) {
      messages.push(msg);
    }

    messages.push({ role: "user", content: question });

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.OPENROUTER_MODEL,
        messages,
        temperature: isAnalysisMode ? 0 : 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://github.com/HunterBot",
          "X-Title": "HunterBot Discord",
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenRouter API Error:", error.response?.data || error.message);
    return "⚠️ Maaf, Hunter sedang mengalami gangguan koneksi. Silakan coba lagi nanti.";
  }
}

module.exports = { generateReply };

