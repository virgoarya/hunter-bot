const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const { resolveRootPath } = require("../utils/dataPath");
const { postToAI } = require("../utils/aiProxy");

const CACHE_FILE = resolveRootPath("reuters_cache.json");
// Bing News RSS for Reuters Finance items
const BING_RSS_URL = "https://www.bing.com/news/search?q=site:reuters.com+finance&format=rss";

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        }
    } catch (e) {
        console.error("Reuters cache load error:", e.message);
    }
    return { lastLinks: [] };
}

function saveCache(cache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (e) {
        console.error("Reuters cache save error:", e.message);
    }
}

let reutersRateLimitUntil = 0;
const REUTERS_RETRY_DELAY = 2000;

async function translateAndExpand(title, snippet, retryCount = 0) {
  try {
    if (Date.now() < reutersRateLimitUntil) {
      const waitMs = reutersRateLimitUntil - Date.now();
      console.log(`⏳ Reuters translation rate limited, waiting ${waitMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    const prompt = `Anda adalah asissten analis Makro Hunter.
Tugas Anda adalah menerjemahkan dan mengembangkan (expand) headline berita Reuters berikut menjadi 1-2 paragraf konten yang tajam, profesional, dan bernada institutional desk.

MASUKAN:
Headline: "${title}"
Snippet: "${snippet}"

ATURAN:
1. Hasil harus dalam Bahasa Indonesia yang formal dan berwibawa.
2. Gunakan istilah keuangan internasional jika lebih presisi.
3. Kembangkan snippet menjadi narasi yang menjelaskan implikasi atau konteks berita tersebut jika memungkinkan (berdasarkan data yang ada).
4. JANGAN mengarang data jika tidak ada di snippet/headline, cukup buat narasi profesional dari informasi yang tersedia.
5. Output HANYA hasil terjemahan/ekspansi (1-2 paragraf).

Hasil (Indonesian):`;

    const result = await postToAI(
      [{ role: "user", content: prompt }],
      { temperature: 0.3, max_tokens: 500, timeout: 30000 }
    );

    return result.trim();
  } catch (error) {
    console.error("Reuters translation/expansion error:", error.message);

    if (retryCount < 3) {
      const retryAfter = error.response?.headers?.['retry-after'] 
        ? parseInt(error.response.headers['retry-after']) * 1000 
        : REUTERS_RETRY_DELAY * (retryCount + 1);
      
      console.log(`⏳ Rate limited, retrying in ${retryAfter}ms (attempt ${retryCount + 1}/3)...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return translateAndExpand(title, snippet, retryCount + 1);
    }

    return `${title}\n\n${snippet}`;
  }
}

async function fetchReutersFinance() {
    try {
        console.log("📰 Fetching Reuters Headlines with Snippets via Bing RSS...");

        let response;
        try {
            response = await axios.get(BING_RSS_URL, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/rss+xml, application/xml, */*"
                },
                timeout: 15000,
                maxRedirects: 5
            });
        } catch (error) {
            if (error.response?.status === 429) {
                console.warn("⚠️ Bing RSS rate limited (429). Skipping Reuters fetch for now.");
                // Set a short cooldown in cache? For now just return empty
                return [];
            }
            throw error; // re-throw other errors
        }

        const $ = cheerio.load(response.data, { xmlMode: true });
        const articles = [];

        $("item").each((i, el) => {
            if (articles.length >= 10) return;

            const title = $(el).find("title").text();
            let link = $(el).find("link").text();
            const description = $(el).find("description").text();

            // Extract real URL if it's a Bing redirect
            if (link.includes("url=")) {
                try {
                    const urlParam = new URL(link).searchParams.get("url");
                    if (urlParam) link = urlParam;
                } catch (e) {
                    // Fallback to original link if parsing fails
                }
            }

            if (title && link) {
                articles.push({ title, link, snippet: description });
            }
        });

        const cache = loadCache();
        const newArticles = [];

        for (const article of articles) {
            if (newArticles.length >= 3) break;
            if (!cache.lastLinks.includes(article.link)) {
                newArticles.push(article);
            }
        }

        if (newArticles.length > 0) {
            console.log(`✨ Found ${newArticles.length} new Reuters headlines.`);

            // Update cache
            const allLinks = [...newArticles.map(a => a.link), ...cache.lastLinks].slice(0, 30);
            saveCache({ lastLinks: allLinks });

            // Translate & Expand (with rate limit protection)
            for (const article of newArticles) {
                console.log("📝 Processing/Expanding Reuters content:", article.title.substring(0, 30));
                article.expandedContent = await translateAndExpand(article.title, article.snippet);
            }
        }

        return newArticles;
    } catch (error) {
        console.error("Reuters (Bing) fetch error:", error.message);
        return [];
    }
}

module.exports = { fetchReutersFinance };
