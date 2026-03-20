const axios = require("axios");

async function analyzeMacroAI(macroData) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a professional macro liquidity analyst for forex traders."
          },
          {
            role: "user",
            content: `Analyze this macro condition:\n${macroData}`
          }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("AI RAW RESPONSE:", response.data);
    return response.data.choices[0].message.content;

  } catch (err) {
    console.error("❌ OpenRouter Error:", err.response?.data || err.message);
    return "AI failed to respond.";
  }
}

module.exports = { analyzeMacroAI };