const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// Utility: Strip HTML tags, preserve line breaks
function cleanHtml(html) {
    if (!html) return '';
    // Convert <br> tags to newlines
    let text = html.replace(/<br\s*\/?>/gi, '\n');
    // Convert paragraph tags to newlines
    text = text.replace(/<[/]?p[^>]*>/gi, '\n');
    // Convert list items to newlines
    text = text.replace(/<[/]?li[^>]*>/gi, '\n');
    // Remove any remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode HTML entities and trim using cheerio
    const $ = cheerio.load('<div>' + text + '</div>');
    return $.text().trim();
}

const CACHE_FILE = path.join(__dirname, "../twitter_cache.json");

// Updated list of Nitter instances (some may be down, we try them in order of reliability)
const RSS_URLS = [
    "https://nitter.net/KobeissiLetter/rss",
    "https://nitter.privacydev.net/KobeissiLetter/rss",
    "https://nitter.poast.org/KobeissiLetter/rss",
    "https://nitter.perennialte.ch/KobeissiLetter/rss",
    "https://nitter.actionsack.com/KobeissiLetter/rss",
    "https://nitter.weiler.rocks/KobeissiLetter/rss",
    "https://nitter.cz/KobeissiLetter/rss",
    "https://nitter.unixfox.eu/KobeissiLetter/rss",
    "https://nitter.mastodont.cat/KobeissiLetter/rss",
    "https://nitter.42l.fr/KobeissiLetter/rss"
];

// HTTP client with better defaults
const httpAgent = new (require('http').Agent)({ keepAlive: true });
const httpsAgent = new (require('https').Agent)({ keepAlive: true, rejectUnauthorized: false });

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
            const rawText = $(el).find(".tgme_widget_message_text").text();
            const date = $(el).find(".tgme_widget_message_date time").attr("datetime");
            const link = $(el).find(".tgme_widget_message_date").attr("href");

            if (rawText && link) {
                items.push({
                    id: link, // Uses the message URL as a unique ID
                    content: cleanHtml(rawText),
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

// Rate limit tracking
let translationRateLimitUntil = 0;
const TRANSLATION_RETRY_DELAY = 2000; // 2 seconds base delay

async function translateTweet(text, retryCount = 0) {
    try {
        // Check if we're currently rate limited
        if (Date.now() < translationRateLimitUntil) {
            const waitMs = translationRateLimitUntil - Date.now();
            console.log(`⏳ Translation rate limited, waiting ${waitMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }

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
                max_tokens: 500
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                },
                timeout: 10000 // 10 second timeout
            }
        );

        // Check for rate limit headers
        const remaining = response.headers['x-ratelimit-remaining'];
        const resetTime = response.headers['x-ratelimit-reset'];
        if (remaining && parseInt(remaining) < 5) {
            console.warn(`⚠️ Translation API rate limit low: ${remaining} remaining`);
        }
        if (resetTime) {
            const resetTimestamp = parseInt(resetTime) * 1000;
            if (resetTimestamp > Date.now()) {
                translationRateLimitUntil = resetTimestamp + 5000; // Add 5s buffer
            }
        }

        const result = response.data.choices[0]?.message?.content?.trim();
        return result ? cleanHtml(result) : text;
    } catch (error) {
        console.error("Translation error:", error.message);

        // Check if it's a rate limit error (429)
        if (error.response?.status === 429 && retryCount < 3) {
            const retryAfter = error.response.headers['retry-after'] ?
                parseInt(error.response.headers['retry-after']) * 1000 :
                TRANSLATION_RETRY_DELAY * (retryCount + 1);

            console.log(`⏳ Rate limited, retrying in ${retryAfter}ms (attempt ${retryCount + 1}/3)...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            return translateTweet(text, retryCount + 1);
        }

        // For other errors, return original text
        return text;
    }
}

// Batch translate multiple tweets with delay between requests to avoid rate limits
async function translateBatch(tweets) {
    if (!tweets || tweets.length === 0) return tweets;

    console.log(`📝 Batch translating ${tweets.length} tweets...`);

    const BATCH_DELAY = 1000; // 1 second between translation calls
    const results = [];

    for (let i = 0; i < tweets.length; i++) {
        const tweet = tweets[i];
        try {
            const translated = await translateTweet(tweet.content);
            tweet.translatedContent = translated;
            results.push(tweet);

            // Add delay between calls (except after last one)
            if (i < tweets.length - 1) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        } catch (error) {
            console.error(`Translation failed for tweet ${tweet.id}:`, error.message);
            tweet.translatedContent = tweet.content; // Fallback to original
            results.push(tweet);
        }
    }

    console.log(`✅ Batch translation completed: ${results.length}/${tweets.length} successful`);
    return results;
}

async function fetchLatestTweets() {
    try {
        console.log("🐦 Fetching feeds from @KobeissiLetter...");
        let items = [];
        let source = null;

        // Step 1: Try Nitter Instances with staggered delays and better error handling
        console.log(`[Twitter] Trying ${RSS_URLS.length} Nitter mirrors...`);
        for (let i = 0; i < RSS_URLS.length; i++) {
            const url = RSS_URLS[i];
            try {
                console.log(`[Twitter-Retry ${i + 1}/${RSS_URLS.length}] Trying: ${url}`);

                const response = await axios.get(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                        "Accept": "application/rss+xml, application/xml, */*",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Referer": "https://nitter.net/"
                    },
                    timeout: 8000, // 8 seconds timeout
                    httpAgent: httpAgent,
                    httpsAgent: httpsAgent,
                    maxRedirects: 3,
                    validateStatus: function (status) {
                        // Accept 200-299, but we'll handle errors manually
                        return status >= 200 && status < 300;
                    }
                });

                if (response.status === 200 && response.data) {
                    const $ = cheerio.load(response.data, { xmlMode: true });
                    $("item").each((i, el) => {
                        const rawContent = $(el).find("description").text() || $(el).find("title").text();
                        const guid = $(el).find("guid").text();
                        const link = $(el).find("link").text();
                        if (rawContent && (guid || link)) {
                            items.push({
                                id: guid || link,
                                content: cleanHtml(rawContent),
                                link: link,
                                date: $(el).find("pubDate").text()
                            });
                        }
                    });

                    if (items.length > 0) {
                        source = "nitter";
                        console.log(`✅ Nitter success [${url}]: ${items.length} items`);
                        break;
                    } else {
                        console.log(`⚠️ Nitter [${url}] returned 0 items (empty RSS)`);
                    }
                } else {
                    console.warn(`⚠️ Nitter [${url}] returned status ${response.status}`);
                }
            } catch (err) {
                const status = err.response?.status;
                const message = err.message;

                if (status === 429) {
                    console.warn(`[Twitter-Retry] Rate limited (429): ${url}`);
                } else if (status === 403) {
                    console.warn(`[Twitter-Retry] Forbidden (403): ${url} - instance blocked`);
                } else if (status === 503) {
                    console.warn(`[Twitter-Retry] Service Unavailable (503): ${url}`);
                } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
                    console.warn(`[Twitter-Retry] Connection failed (${err.code}): ${url}`);
                } else {
                    console.warn(`[Twitter-Retry] Error (${message}): ${url}`);
                }
            }

            // Add delay before trying next mirror (increase delay after each failure)
            if (i < RSS_URLS.length - 1) {
                const delay = Math.min(500 + (i * 200), 2000); // 500ms to 2000ms progressive delay
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Step 2: Fallback to Telegram if Nitter failed completely
        if (items.length === 0) {
            console.log("✈️ All Nitter mirrors failed, activating Telegram fallback...");
            try {
                items = await fetchFromTelegram();
                if (items.length > 0) {
                    source = "telegram";
                    console.log(`✅ Telegram fallback success: ${items.length} items`);
                } else {
                    console.warn("⚠️ Telegram fallback returned 0 items");
                }
            } catch (telegramErr) {
                console.error("❌ Telegram fallback error:", telegramErr.message);
            }
        }

        // Final check: if still no items, return empty
        if (items.length === 0) {
            console.error("❌ All sources (Nitter & Telegram) failed completely");
            return [];
        }

        const cache = loadCache();
        const newTweets = [];

        // Determine which cache ID to use
        let lastId = null;
        let cacheKey = null;
        if (source === "nitter") {
            lastId = cache.lastNitterId;
            cacheKey = "lastNitterId";
        } else if (source === "telegram") {
            lastId = cache.lastTelegramId;
            cacheKey = "lastTelegramId";
        }

        // If it's the first time for this source, initialize cache and return nothing
        if (!lastId) {
            cache[cacheKey] = items[0].id;
            saveCache(cache);
            console.log(`✅ Initialized ${source} cache with ID: ${items[0].id.substring(0, 30)}...`);
            return [];
        }

        // Identify new items (stop at first seen tweet)
        for (const tweet of items) {
            if (tweet.id === lastId) break;
            newTweets.push(tweet);
        }

        if (newTweets.length === 0) {
            console.log("📭 No new tweets found (cache hit).");
            return [];
        }

        console.log(`📦 Found ${newTweets.length} new tweets from ${source}`);

        // Update cache immediately (prevent re-fetching on next run)
        cache[cacheKey] = items[0].id;
        saveCache(cache);

        // Translate new items in batch (with rate limit protection)
        const translatedTweets = await translateBatch(newTweets);

        // Return in chronological order (oldest first)
        return translatedTweets.reverse();
    } catch (error) {
        console.error("❌ Twitter service main error:", error.message);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
        }
        return [];
    }
}

module.exports = { fetchLatestTweets };
