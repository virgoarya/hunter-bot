const axios = require("axios");
const cheerio = require("cheerio");

async function testTelegram() {
    console.log("=== TESTING TELEGRAM SCRAPER ===\n");
    const url = "https://t.me/s/TheKobeissiLetter";
    
    try {
        const res = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        });
        
        const $ = cheerio.load(res.data);
        const posts = [];
        
        $(".tgme_widget_message_wrap").each((i, el) => {
            const text = $(el).find(".tgme_widget_message_text").text();
            const date = $(el).find(".tgme_widget_message_date time").attr("datetime");
            const link = $(el).find(".tgme_widget_message_date").attr("href");
            
            if (text) {
                posts.push({ text, date, link });
            }
        });
        
        console.log(`✅ Found ${posts.length} posts.`);
        posts.slice(-3).forEach((p, idx) => {
            console.log(`\n--- Post ${idx + 1} ---`);
            console.log(`Date: ${p.date}`);
            console.log(`Content: ${p.text.substring(0, 100)}...`);
            console.log(`Link: ${p.link}`);
        });
        
    } catch (e) {
        console.error("❌ Telegram scrape failed:", e.message);
    }
}

testTelegram();
