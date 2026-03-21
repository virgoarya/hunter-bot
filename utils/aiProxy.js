const axios = require("axios");

/**
 * Multi-Provider AI Proxy (OpenRouter + Google Gemini)
 * Failover Sequence: OpenRouter -> Google Gemini -> NVIDIA Nemotron (OpenRouter)
 */
async function postToAI(messages, options = {}) {
    const primaryModel = process.env.OPENROUTER_MODEL || "arcee-ai/trinity-large-preview:free";
    const apiKeyOR = process.env.OPENROUTER_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;

    // Config for OpenRouter
    const orConfig = {
        timeout: options.timeout || 45000,
        headers: {
            "Authorization": `Bearer ${apiKeyOR}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/HunterBot",
            "X-Title": "HunterBot Discord"
        }
    };

    // Helper: Call OpenRouter
    const callOpenRouter = async (model) => {
        const payload = {
            model: model,
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens || 2000
        };
        console.log(`📡 [OpenRouter] Calling ${model}...`);
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", payload, orConfig);
        return response.data.choices[0].message.content;
    };

    // Helper: Call Google Gemini (REST)
    const callGemini = async () => {
        if (!apiKeyGemini) throw new Error("GEMINI_API_KEY_MISSING");
        
        const model = "gemini-1.5-flash-latest";
        console.log(`📡 [Google Gemini] Calling ${model}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyGemini}`;
        
        const systemMessage = messages.find(m => m.role === "system");
        const userMessages = messages.filter(m => m.role !== "system");

        const contents = userMessages.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
        }));

        const payload = {
            contents: contents,
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.max_tokens || 2000
            }
        };

        if (systemMessage) {
            payload.system_instruction = {
                parts: [{ text: systemMessage.content }]
            };
        }

        const response = await axios.post(url, payload, { timeout: options.timeout || 30000 });
        
        if (response.data.candidates && response.data.candidates[0].content) {
            return response.data.candidates[0].content.parts[0].text;
        }
        throw new Error("GEMINI_INVALID_RESPONSE");
    };

    // --- EXECUTION FLOW ---

    try {
        // 1. Try Primary (OpenRouter)
        return await callOpenRouter(primaryModel);
    } catch (error) {
        const status = error.response?.status;
        console.warn(`⚠️ [Primary Failed] ${primaryModel} status: ${status}`);

        // 2. Try Google Gemini as first fallback for 429/402/401/403/5xx
        if (status === 429 || status === 402 || status === 401 || status === 403 || status >= 500) {
            try {
                console.log("🔄 [Fallback 1] Switching to Google Gemini...");
                return await callGemini();
            } catch (geminiError) {
                console.error("❌ [Gemini Failed]:", geminiError.message);
                
                // 3. Try NVIDIA Nemotron (OpenRouter) as last resort
                try {
                    console.log("🔄 [Fallback 2] Final attempt with NVIDIA Nemotron (OpenRouter)...");
                    return await callOpenRouter("nvidia/nemotron-3-super-120b-a12b:free");
                } catch (lastError) {
                    console.error("💀 [All Providers Failed]");
                    throw lastError;
                }
            }
        }
        throw error;
    }
}

module.exports = { postToAI };
