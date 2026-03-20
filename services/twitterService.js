const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const CACHE_FILE = path.join(__dirname, "../twitter_cache.json");
const RSS_URL = "https://nitter.perennialte.ch/KobeissiLetter/rss";

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        }
    } catch (e) {
        console.error("Twitter cache load error:", e.message);
    }
    return { lastTweetId: null };
}

function saveCache(cache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (e) {
        console.error("Twitter cache save error:", e.message);
    }
}

async function translateTweet(text) {
    try {
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
    } catch (error) {
        console.error("Translation error:", error.message);
        return text; // Fallback to original
    }
}

async function fetchLatestTweets() {
    try {
        console.log("🐦 Fetching feeds from @KobeissiLetter via Nitter RSS...");
        const response = await axios.get(RSS_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data, { xmlMode: true });
        const items = [];
        
        $("item").each((i, el) => {
            const title = $(el).find("title").text();
            const description = $(el).find("description").text();
            const link = $(el).find("link").text();
            const pubDate = $(el).find("pubDate").text();
            const guid = $(el).find("guid").text();

            items.push({
                id: guid || link,
                content: description || title,
                link: link,
                date: pubDate
            });
        });

        const cache = loadCache();
        const newTweets = [];

        // If it's the first time, just store the latest ID and return nothing 
        // to avoid spamming historical tweets
        if (!cache.lastTweetId) {
            if (items.length > 0) {
                cache.lastTweetId = items[0].id;
                saveCache(cache);
                console.log("✅ Initialized Twitter cache with ID:", cache.lastTweetId);
            }
            return [];
        }

        for (const tweet of items) {
            if (tweet.id === cache.lastTweetId) break;
            newTweets.push(tweet);
        }

        if (newTweets.length > 0) {
            cache.lastTweetId = items[0].id;
            saveCache(cache);

            // Translate new tweets
            for (const tweet of newTweets) {
                console.log("📝 Translating tweet:", tweet.id);
                tweet.translatedContent = await translateTweet(tweet.content);
            }
        }

        return newTweets.reverse(); // Return in chronological order (oldest first)
    } catch (error) {
        console.error("Twitter fetch error:", error.message);
        return [];
    }
}

module.exports = { fetchLatestTweets };
