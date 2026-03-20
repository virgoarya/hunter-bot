const axios = require("axios");

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

Kamu adalah analis macro institutional desk. Berikan interpretasi CEPAT, SINGKAT, dan TAJAM dalam bahasa Indonesia (Maksimal 2 paragraf).
Jelaskan:
1. Apakah ini "Beat" (lebih baik dari ekspektasi), "Miss" (lebih buruk), atau in-line?
2. Bagaimana reaksi algoritmik (Smart Money) / institutional positioning terhadap data ini?
3. Apa dampaknya secara instan terhadap DXY (USD), Gold, dan Equity (Indeks Saham)?
`;

        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: process.env.OPENROUTER_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "Kamu adalah Senior Macro Analyst di Institutional Desk yang memberikan flash commentary untuk rilis berita. Jaga nadanya tetap profesional, tajam, dan langsung ke intinya.",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                },
                timeout: 30000,
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("Calendar AI interpretation error:", error.message);
        return null;
    }
}

module.exports = {
    generateCalendarInterpretation,
};
