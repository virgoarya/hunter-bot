const { postToAI } = require("../utils/aiProxy");
const { getMacroState } = require("./macroData");
const { classifyRegime } = require("./regime");

/**
 * Generate AI interpretation for a newly released high-impact economic event
 * @param {Object} eventData - { eventName, actual, forecast, previous, country }
 */
async function generateCalendarInterpretation(eventData) {
    if (!eventData || !eventData.eventName || !eventData.actual) return null;

    try {
        const prompt = `
Data ekonomi penting baru saja rilis:
- Negara: ${eventData.country}
- Event: ${eventData.eventName}
- Actual: ${eventData.actual}
- Forecast: ${eventData.forecast || "N/A"}
- Previous: ${eventData.previous || "N/A"}

Kamu adalah analis macro institutional desk. Berikan flash commentary CEPAT, SINGKAT, dan TAJAM dalam bahasa Indonesia bergaya Quant Fund (Maksimal 2 paragraf padat).
JANGAN sekadar mengulang angka di atas, tetapi JAWAB:
1. "Beat", "Miss", atau in-line? Bagaimana reaksi awal algoritmik (Smart Money) merespon deviasi dari Forecast ini?
2. Bagaimana kaitannya dengan narasi makro saat ini (apakah mendukung skenario inflasi tinggi, pelambatan, atau risk-on)?
3. Apa dampaknya secara instan terhadap DXY (Dolar), Gold (Emas), dan Equity (Indeks Saham seperti Nasdaq)?
`;

        
        const state = getMacroState();
        let regimeContext = "Menunggu data makro terkini.";
        if (state && state.isHealthy) {
            const regime = classifyRegime(state);
            regimeContext = `Konteks Tambahan: Saat ini pasar sedang berada di rezim ${regime.regime} (${regime.description}).`;
        }

        const systemContent = "Kamu adalah Senior Macro Analyst di Institutional Desk yang memberikan flash commentary untuk rilis berita. Jaga nadanya tetap profesional, tajam, dan langsung ke intinya.";
        const userContent = prompt + "\n\n" + regimeContext;

        return await postToAI([
            { role: "system", content: systemContent },
            { role: "user", content: userContent }
        ], { temperature: 0.3, max_tokens: 250 });

    } catch (error) {
        console.error("Calendar AI interpretation error:", error.message);
        return null;
    }
}

module.exports = {
    generateCalendarInterpretation,
};
