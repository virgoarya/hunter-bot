const axios = require("axios");
require("dotenv").config();

async function diagnoseAllModels() {
    const key = process.env.GEMINI_API_KEY;
    const models = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash-lite-preview-02-05",
        "gemini-pro"
    ];

    console.log("=== GEMINI QUOTA DIAGNOSTICS ===\n");

    for (const model of models) {
        process.stdout.write(`Testing ${model}... `);
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            const res = await axios.post(url, { contents: [{ parts: [{ text: "hi" }] }] }, { timeout: 10000 });
            console.log("✅ SUCCESS");
        } catch (e) {
            const msg = e.response?.data?.error?.message || e.message;
            if (msg.includes("limit: 0")) {
                console.log("❌ FAIL (Limit 0)");
            } else if (msg.includes("404")) {
                console.log("❌ FAIL (404/Not Found)");
            } else {
                console.log(`❌ FAIL (${msg.substring(0, 50)})`);
            }
        }
    }
}

diagnoseAllModels();
