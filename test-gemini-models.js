const axios = require("axios");
require("dotenv").config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    
    try {
        console.log("📡 Listing models for Gemini key...");
        const res = await axios.get(url);
        console.log("\n✅ MODELS FOUND:");
        console.log(JSON.stringify(res.data.models.map(m => m.name), null, 2));
    } catch (e) {
        console.error("\n❌ FAILED TO LIST MODELS:");
        console.error(e.response?.data || e.message);
    }
}

listModels();
