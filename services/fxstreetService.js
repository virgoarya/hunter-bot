const axios = require("axios");
const cheerio = require("cheerio");

const FXSTREET_RSS_URL = "https://www.fxstreet-id.com/rss/news";

function cleanHtml(html) {
    if (!html) return '';
    const $ = cheerio.load('<div>' + html + '</div>');
    return $.text().trim();
}

async function fetchFxstreetNews() {
    try {
        console.log("📰 Fetching feeds from FXStreet-ID (RSS)...");
        
        const controllers = new AbortController();
        const timeoutId = setTimeout(() => controllers.abort(), 15000);
        
        const response = await axios.get(FXSTREET_RSS_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/rss+xml, application/xml, text/xml, */*",
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout: 15000,
            signal: controllers.signal
        });

        clearTimeout(timeoutId);

        if (response.status !== 200 || !response.data) {
            console.warn(`⚠️ FXStreet RSS returned status ${response.status}`);
            return [];
        }

        const items = [];
        const $ = cheerio.load(response.data, { xmlMode: true });

        $("item").each((i, el) => {
            const title = cleanHtml($(el).find("title").text());
            const link = $(el).find("link").text();
            const date = $(el).find("pubDate").text();
            const description = cleanHtml($(el).find("description").text());

            if (title && link) {
                items.push({
                    id: link,
                    title: title,
                    content: description,
                    link: link,
                    date: date
                });
            }
        });

        console.log(`✅ FXStreet RSS success: ${items.length} news items found`);
        return items.slice(0, 10);
    } catch (error) {
        if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
            console.error("❌ FXStreet service timeout");
        } else if (error.response?.status === 403) {
            console.error("❌ FXStreet service forbidden (403) - site may have blocked requests");
        } else {
            console.error("❌ FXStreet service error:", error.message);
        }
        return [];
    }
}

module.exports = { fetchFxstreetNews };
