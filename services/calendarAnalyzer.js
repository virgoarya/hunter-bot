const { postToAI } = require("../utils/aiProxy");
const { getMacroState } = require("./macroData");
const { classifyRegime } = require("./regime");
const { detectCorrelationPatterns } = require("./correlationEngine");

/**
 * Generate AI interpretation for a newly released high-impact economic event
 * @param {Object} eventData - { eventName, actual, forecast, previous, country }
 */
async function generateCalendarInterpretation(eventData) {
    if (!eventData || !eventData.eventName || !eventData.actual) return null;

    try {
        const state = getMacroState();
        const regime = state && state.isHealthy ? classifyRegime(state) : { regime: "UNDEFINED", description: "Data tidak lengkap" };
        const correlation = detectCorrelationPatterns(state);

        // Extract relevant market data
        const macroData = {
            DXY: state?.DXY?.close ?? "N/A",
            DXY_change: state?.DXY?.change ?? "0",
            GOLD: state?.GOLD?.close ?? "N/A",
            GOLD_change: state?.GOLD?.change ?? "0",
            NASDAQ: state?.NASDAQ?.close ?? "N/A",
            NASDAQ_change: state?.NASDAQ?.change ?? "0",
            US10Y: state?.US10Y?.close ?? "N/A",
            US10Y_change: state?.US10Y?.change ?? "0",
            VIX: state?.VIX?.close ?? "N/A"
        };

        const prompt = `
## FLASH COMMENTARY: RELEASED ECONOMIC DATA

DATA RILIS:
- Country: ${eventData.country}
- Event: ${eventData.eventName}
- Actual: ${eventData.actual}
- Forecast: ${eventData.forecast || "N/A"}
- Previous: ${eventData.previous || "N/A"}

## KONTEKS PASAR SAAT INI:
- Rezim: ${regime.regime} (${regime.description})
- Korelasi: ${correlation?.signal || "NETRAL"} (${correlation?.description || "N/A"})
- DXY: ${macroData.DXY} (${macroData.DXY_change}%)
- Gold: ${macroData.GOLD} (${macroData.GOLD_change}%)
- Nasdaq: ${macroData.NASDAQ} (${macroData.NASDAQ_change}%)
- US10Y: ${macroData.US10Y}% (${macroData.US10Y_change}%)
- VIX: ${macroData.VIX}

## INSTRUKSI ANALISIS (CRITICAL THINKING):

**STEP 1: BEAT/MISS/IN-LINE ASSESSMENT**
- Compare Actual vs Forecast (dan vs Previous jika relevan)
- Quantify deviation: (Actual - Forecast) / Forecast * 100 = __%
- Klasifikasi: BEAT (>0.5% deviasi), MISS (<-0.5%), IN-LINE (±0.5%)

**STEP 2: MARKET IMPACT MECHANISM**
- Jelaskan WHY reaksi pasar akan terjadi (cause-effect chain).
- Aset mana yang langsung terpengaruh (leading) vs mana yang lagging?
- Contoh: "CPI tinggi → Fed hawkish bias → DXY strength → Gold pressure"

**STEP 3: CONSISTENCY CHECK**
- Apakah data ini konsisten dengan narasi rezim saat ini?
- Ada konflik dengan data sebelumnya? Sebutkan.
- Apakah ada divergensi dengan asset price reaction yang sudah terjadi?

**STEP 4: UNCERTAINTY & CONFIDENCE**
- Faktor-faktor yang membuat dampak第二节:
  * [ ] Data released during low liquidity session?
  * [ ]已经定价在预期中吗? (如果|Actual - Forecast| < 0.3%, cenderung bereits priced-in)
  * [ ] Apakah ini data turunan (lingkaran ) atau data utama?
- Confidence level: High (>70%) / Medium (40-70%) / Low (<40%)
- Berikan alasan confidence level tersebut.

**STEP 5: SCENARIO IMPLICATIONS**
- Base Case (berdasarkan data saat ini): ___
- If data was a surprise: Dampak多长时间? (intraday / 2-3d / structural shift)
- Potential fade/counter-reaction: JikaData已经priced in sebelumnya, reaksi mungkin cepat hilang (fade within 2 jam).

## OUTPUT FORMAT (MANDATORY):

**Flash Commentary (2-3 paragraf padat):**

[Paragraf 1]:
- Beat/Miss/Inline statement dengan angka spesifik.
- Reaksi瞬间 pasar berdasarkan mechanism.
-引用数据: "DXY 104.5" / "US10Y up 5bps to 4.25%" - gunakan angka aktual dari konteks.

[Paragraf 2]:
- Kaitkan dengan narasi makro dan/atau regime.
- Confidence: High/Med/Low + reasoning.
- Scenario: (Base/Bull/Bear) jika relevan.

[ClosingBaru if confidence < Medium]:
"*Catatan: Analisis ini memiliki confidence ${confidence}% karena [alasan]. Monitor [data lain] untuk konfirmasi.*"

**IMPORTANT**: JANGAN mengulang data yang sudah diberikan. Fokus pada interpretasi dan dampak. Gunakan bahasa Indonesia profesional, to-the-point.
`;

        const systemContent = `Kamu adalah Senior Macro Analyst di Institutional Desk yang memberikan flash commentary untuk rilis berita dengan critical thinking framework.

CRITICAL RULES:
1. Setiap klaim harus didukung oleh data spesifik (citasi: DXY 104.5, US10Y up 5bps).
2. Jika data incomplete, nyatakan confidence <50% dan sebutkan data yang missing.
3. Identify mechanism: jelaskan WHY dampak terjadi (cause-effect chain).
4. Always assess if data was priced-in. Small deviations (<0.3% for econ data) often already in price.
5. Consider session context: London open? NY close? Asian session? (this affects liquidity and reaction intensity).
6. If regime shift happened recently, note that market may interpret data through new regime lens.
7. For high-frequency news (like NFP), intraday reaction lasts 2-4 hours; for slower data (CPI, Fed), effect lasts days.
8. End with confidence percentage and key risk factor.

Output HANYA berisi flash commentary sesuai format, tanpa pengenalan atau penutup berlebihan.`;

        const messages = [
            { role: "system", content: systemContent },
            { role: "user", content: prompt }
        ];

        const result = await postToAI(messages, {
            temperature: 0.4, // Lower for consistency with data
            max_tokens: 600 // Slightly larger for reasoning
        });

        // Post-process: Ensure no meta-commentary
        let cleaned = result
            .replace(/^(Sebagai Senior Macro Analyst|Saya adalah|Analisis untuk|Berikut|Flash Commentary)[^\n]*\n*/i, '')
            .trim();

        // If cleaning removed too much, revert to original
        if (cleaned.length < result.length * 0.5) {
            cleaned = result.trim();
        }

        return cleaned;

    } catch (error) {
        console.error("Calendar AI interpretation error:", error.message);
        return null;
    }
}

module.exports = {
    generateCalendarInterpretation,
};
