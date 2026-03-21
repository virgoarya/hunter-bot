const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const CACHE_FILE = path.join(__dirname, "../twitter_cache.json");
const RSS_URLS = [
    "https://nitter.net/KobeissiLetter/rss",
    "https://nitter.perennialte.ch/KobeissiLetter/rss",
    "https://nitter.poast.org/KobeissiLetter/rss",
    "https://nitter.cz/KobeissiLetter/rss"
];

const TELEGRAM_URL = "https://t.me/s/TheKobeissiLetter";

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        }
    } catch (e) {
        console.error("Twitter cache load error:", e.message);
    }
    return { lastNitterId: null, lastTelegramId: null };
}

async function fetchFromTelegram() {
    try {
        console.log("✈️ Nitter failed, falling back to Telegram Scraper...");
        const response = await axios.get(TELEGRAM_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            },
            timeout: 5000
        });

        const $ = cheerio.load(response.data);
        const items = [];

        $(".tgme_widget_message_wrap").each((i, el) => {
            const text = $(el).find(".tgme_widget_message_text").text();
            const date = $(el).find(".tgme_widget_message_date time").attr("datetime");
            const link = $(el).find(".tgme_widget_message_date").attr("href");

            if (text && link) {
                items.push({
                    id: link, // Uses the message URL as a unique ID
                    content: text,
                    link: link,
                    date: date
                });
            }
        });

        return items.reverse(); // Latest first for consistency with RSS processing
    } catch (e) {
        console.error("❌ Telegram fallback also failed:", e.message);
        return [];
    }
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
        return text; 
    }
}

async function fetchLatestTweets() {
    try {
        console.log("🐦 Fetching feeds from @KobeissiLetter...");
        let response = null;
        let items = [];
        let source = "nitter";

        // Step 1: Try Nitter Instances
        for (const url of RSS_URLS) {
            try {
                response = await axios.get(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    },
                    timeout: 3000 // Faster timeout for mirrors
                });
                if (response && response.data) {
                    const $ = cheerio.load(response.data, { xmlMode: true });
                    $("item").each((i, el) => {
                        items.push({
                            id: $(el).find("guid").text() || $(el).find("link").text(),
                            content: $(el).find("description").text() || $(el).find("title").text(),
                            link: $(el).find("link").text(),
                            date: $(el).find("pubDate").text()
                        });
                    });
                    if (items.length > 0) break;
                }
            } catch (err) {
                console.log(`[Twitter-Retry] Mirror failing: ${url} (${err.message})`);
            }
        }

        // Step 2: Fallback to Telegram if Nitter failed
        if (items.length === 0) {
            items = await fetchFromTelegram();
            source = "telegram";
        }

        if (items.length === 0) {
            console.warn("📭 All sources (Nitter & Telegram) failed or returned no items.");
            return [];
        }

        const cache = loadCache();
        const newTweets = [];
        const lastId = (source === "nitter") ? cache.lastNitterId : cache.lastTelegramId;

        // If it's the first time for this source, initialize and return nothing
        if (!lastId) {
            if (source === "nitter") cache.lastNitterId = items[0].id;
            else cache.lastTelegramId = items[0].id;
            saveCache(cache);
            console.log(`✅ Initialized ${source} cache with ID:`, items[0].id);
            return [];
        }

        // Identify new items
        for (const tweet of items) {
            if (tweet.id === lastId) break;
            newTweets.push(tweet);
        }

        // Update cache
        if (newTweets.length > 0) {
            if (source === "nitter") cache.lastNitterId = items[0].id;
            else cache.lastTelegramId = items[0].id;
            saveCache(cache);

            // Translate new items
            for (const tweet of newTweets) {
                console.log(`📝 Translating ${source} update:`, tweet.id);
                tweet.translatedContent = await translateTweet(tweet.content);
            }
        }

        return newTweets.reverse(); // Chronological order
    } catch (error) {
        console.error("Twitter service main error:", error.message);
        return [];
    }
}

module.exports = { fetchLatestTweets };
