const axios = require("axios");

/**
 * Centered utility for OpenRouter AI calls with Fallback support.
 */
async function postToOpenRouter(messages, options = {}) {
    const primaryModel = process.env.OPENROUTER_MODEL || "arcee-ai/trinity-large-preview:free";
    const fallbackModel = "nvidia/nemotron-3-super-120b-a12b:free";
    const apiKey = process.env.OPENROUTER_API_KEY;

    const config = {
        timeout: options.timeout || 45000,
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/HunterBot",
            "X-Title": "HunterBot Discord"
        }
    };

    const payload = {
        model: options.model || primaryModel,
        messages: messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens || 2000
    };

    try {
        console.log(`📡 [AI Request] Calling ${payload.model}...`);
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", payload, config);
        return response.data;
    } catch (error) {
        const errorData = error.response?.data?.error || {};
        const status = error.response?.status;

        console.error(`⚠️ [AI Error] ${payload.model} failed (Status: ${status}):`, errorData.message || error.message);

        // Conditions for Fallback: Rate Limit (429) OR Payment Required (402) OR Server Error (5xx)
        if ((status === 429 || status === 402 || status >= 500) && payload.model !== fallbackModel) {
            console.log(`🔄 [AI Fallback] Attempting failover to: ${fallbackModel}...`);
            
            const fallbackPayload = { ...payload, model: fallbackModel };
            try {
                const fallbackResponse = await axios.post("https://openrouter.ai/api/v1/chat/completions", fallbackPayload, config);
                console.log(`✅ [AI Fallback] Success with ${fallbackModel}`);
                return fallbackResponse.data;
            } catch (fallbackError) {
                console.error(`❌ [AI Final Failure] Both models failed:`, fallbackError.response?.data?.error?.message || fallbackError.message);
                throw fallbackError;
            }
        }

        throw error;
    }
}

module.exports = { postToOpenRouter };
