const { fetchLatestTweets } = require("./services/twitterService");
require("dotenv").config();

// We need to access the private translate function in twitterService.js
// but since it's not exported, we'll just test a real fetch with a small sample
// if we mock the item list.

async function testTranslationQuality() {
    const testText = "The Fed is trapped. If they cut rates, inflation returns. If they hold, the economy breaks. We are' seeing the beginning of a hard landing scenario. Markets are mispricing the structural shift in real yields.";
    
    // For testing, I'll temporarily export translateTweet or just use it here
    // But better to just check if I can run the twitterService with a mock.
    
    console.log("--- TESTING TRANSLATION QUALITY ---");
    console.log("Original:", testText);
    
    // I will use the actual code from twitterService.js to test here
    const axios = require("axios");
    async function translateTest(text) {
        const prompt = `Anda adalah asisten translasi profesional Makro Hunter. 
Terjemahkan postingan Twitter dari @KobeissiLetter berikut ke Bahasa Indonesia yang profesional, tajam, dan memiliki nada institutional desk. 

ATURAN:
1. JANGAN kurangi detail teknis atau data angka. 
2. Hindari gaya bahasa informal. 
3. Gunakan istilah keuangan global (English) jika lebih presisi dalam konteks profesional.
4. Output HANYA hasil terjemahan.

Postingan Twitter:
"${text}"`;

        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: process.env.OPENROUTER_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                }
            }
        );
        return response.data.choices[0].message.content.trim();
    }

    const translated = await translateTest(testText);
    console.log("\nTranslated (Institutional Tone):", translated);
}

testTranslationQuality();
