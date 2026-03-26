const axios = require("axios");
const { EmbedBuilder } = require("discord.js");
const { fetchLatestTweets } = require("./twitterService");
const { fetchReutersFinance } = require("./reutersService");
const { postToAI } = require("../utils/aiProxy");

const CHANNEL_ID = "1475983790684766441"; // Target channel for macro analysis broadcast
const CACHE_FILE = require("path").join(__dirname, "../macro_news_analysis_cache.json");

// Cache untuk menghindari duplicate analysis
let analysisCache = {};

function loadCache() {
  try {
    if (require("fs").existsSync(CACHE_FILE)) {
      const raw = require("fs").readFileSync(CACHE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      analysisCache = parsed;
      console.log(`📂 Loaded macro news analysis cache: ${Object.keys(analysisCache).length} entries`);
    }
  } catch (e) {
    console.warn("Macro news cache load error:", e.message);
    analysisCache = {};
  }
}

function saveCache() {
  try {
    const dir = require("path").dirname(CACHE_FILE);
    if (!require("fs").existsSync(dir)) require("fs").mkdirSync(dir, { recursive: true });
    require("fs").writeFileSync(CACHE_FILE, JSON.stringify(analysisCache, null, 2));
  } catch (e) {
    console.warn("Macro news cache save error:", e.message);
  }
}

// Keywords filter untuk identify market/geopolitik sentiment news
const CRITICAL_KEYWORDS = [
  // Market/Macro
  "inflation", "cpi", "pmi", "gdp", "unemployment", "jobs", "fed", "interest rate", "yield", "treasury",
  "dollar", "usd", "eur", "gbp", "jpy", "gold", "oil", "commodity", "recession", "slowdown", "growth",
  "monetary policy", "fomc", "ecb", "boe", "bank of japan", "boj", "central bank",
  // Geopolitik
  "war", "conflict", "ukraine", "russia", "china", "taiwan", "middle east", "iran", "israel", "gaza",
  "sanctions", "tariff", "trade war", "nuclear", "military", "attack", "crisis", "election", "vote",
  "brexit", "eu", "nato", "us-china", "us-russia",
  // Market sentiment
  "surge", "plunge", "crash", " Rally", "sell-off", "bull", "bear", "volatility", "panic", "fear",
  "greed", "correction", "bubble", "risk", "safe haven"
];

const NEGATIVE_KEYWORDS = [
  "sports", "entertainment", "celebrity", "movie", "music", "game", "award", "graduation", "wedding",
  "restaurant", "food", "travel", "hotel", "fashion", "beauty", "lifestyle", "garden", "pet"
];

function isBreakingNews(title, snippet) {
  const text = (title + " " + (snippet || "")).toLowerCase();

  // Skip jika mengandung kata negatif (bukan berita penting)
  if (NEGATIVE_KEYWORDS.some(k => text.includes(k))) {
    return false;
  }

  // Harus mengandung setidaknya 2 kata kunci penting
  const keywordMatches = CRITICAL_KEYWORDS.filter(k => text.includes(k)).length;
  if (keywordMatches < 1) {
    return false;
  }

  // Cek apakah ada sentiment indicator
  const sentimentWords = ["up", "down", "rise", "fall", "gain", "loss", "increase", "decrease", "higher", "lower", "strong", "weak", "bullish", "bearish"];
  const hasSentiment = sentimentWords.some(w => text.includes(w));

  // Cek apakah ada angka/percentage (sering di berita penting)
  const hasNumbers = /\d+%?/.test(text);

  return hasSentiment || hasNumbers || keywordMatches >= 2;
}

async function analyzeMacroNewsWithAI(newsItem) {
  const cacheKey = `${newsItem.source}:${newsItem.link || newsItem.title}`;
  if (analysisCache[cacheKey]) {
    console.log(`♻️ Using cached analysis for: ${newsItem.title.substring(0, 30)}...`);
    return analysisCache[cacheKey];
  }

  try {
    const source = newsItem.source || "Unknown";
    const title = newsItem.title || newsItem.event || "";
    const snippet = newsItem.snippet || newsItem.content || "";
    const link = newsItem.link || "";

    // Additional context: current market state if available
    let marketContext = "";
    try {
      const { getMacroState } = require("./macroData");
      const state = getMacroState();
      if (state && state.isHealthy) {
        marketContext = `
Current Market Snapshot:
- DXY: ${state.DXY?.close} (${state.DXY?.change}%)
- US10Y: ${state.US10Y?.close}% (${state.US10Y?.change})
- NASDAQ: ${state.NASDAQ?.close} (${state.NASDAQ?.change})
- GOLD: ${state.GOLD?.close} (${state.GOLD?.change})
- VIX: ${state.VIX?.close}`;
      }
    } catch (e) {
      // Ignore if macroState not available
    }

    const prompt = `
## CRITICAL THINKING FRAMEWORK: MACRO NEWS IMPACT ANALYSIS

You are a senior macro analyst at an institutional trading desk. Analyze the following breaking news through multiple lenses.

=== NEWS ===
Source: ${source}
Title: ${title}
Context: ${snippet}
${marketContext}

=== ANALYSIS FRAMEWORK ===

1. **WHAT HAPPENED?** (Objective facts only - 1 sentence)

2. **MARKET IMPACT ASSESSMENT:**
   - Which asset classes will be affected? (Currencies, Rates, Equities, Commodities, Volatility)
   - Direction of impact: Bullish / Bearish / Neutral for each
   - Timeframe: Intraday / Short-term (1-5 days) / Structural (>1 week)

3. **MARKET REASONING (Chain of Cause-Effect):**
   Explain the logical chain: "[Event] → [Mechanism] → [Market Reaction]"
   Example: "Higher-than-expected CPI → Fed Hawkishness → USD Strength, Rates Up, Equities Down"

4. **CONTRARIAN VIEW / SECOND-ORDER EFFECTS:**
   - What if the market overreacts?
   - What are the unintended consequences?
   - Is this already priced in?

5. **KEY TRIGGERS TO WATCH:**
   - What data/events will confirm or invert this thesis?
   - Next FOMC? Next data release? Key levels?

6. **CONFIDENCE & TIMEFRAME:**
   - Confidence: High (>75%) / Medium (50-75%) / Low (<50%)
   - Primary timeframe for this impact
   - Risk: What would make this analysis wrong?

=== OUTPUT FORMAT (Bahasa Indonesia, Institutional Tone) ===

**BREAKING NEWS ANALYSIS: [Title]**

📌 **Fakta:** [1 sentence objective summary]

📊 **Dampak Market:**
- [Asset]: [Bullish/Bearish/Neutral] - [Timeframe]
- [Asset]: ...

🧠 **Logika:** [Cause-effect chain in 2-3 sentences]

🔄 **Contrarian:** [Second-order effects / overreaction scenarios]

🔭 **Trigger:** [What to watch next]

⚖️ **Confidence:** [High/Med/Low] | ⏱️ **Timeframe:** [Intraday/Short-term/Structural]
⚠️ **Risk:** [Invalidation condition]

Keep it concise (max 20 lines). Use professional Indonesian. Be precise, not verbose.
`;

    const response = await postToAI([
      { role: "system", content: "Kamu adalah Chief Macro Strategist di sebuah hedge fund institusi. Berikan analisis dengan penilaian kritis, jangan follow-the-crowd. Gunakan framework di atas." },
      { role: "user", content: prompt }
    ], { temperature: 0.4, max_tokens: 800, timeout: 20000 });

    let analysis = response?.trim();

    // Validate analysis length - if too short, it's probably an error
    if (!analysis || analysis.length < 50) {
      console.warn(`⚠️ Analysis too short (${analysis?.length} chars) for: ${title.substring(0, 50)}...`);
      analysis = `**Analisis singkat:**\n\n"${title}"\n\n` +
                `📌 **Fakta:** ${snippet.substring(0, 200)}...\n\n` +
                `⚠️ *Analisis detail gagal karena limitasi API. Silakan referensi link untuk konteks lengkap.*`;
    }

    // Cache the result
    analysisCache[cacheKey] = {
      title,
      snippet,
      analysis,
      timestamp: Date.now(),
      source,
      link
    };
    saveCache();

    return analysisCache[cacheKey];

  } catch (error) {
    console.error("Macro news analysis error:", error.message);
    return null;
  }
}

async function fetchAndAnalyzeMacroNews() {
  try {
    console.log("🔍 Fetching and analyzing breaking macro news...");

    // 1. Fetch Twitter (KobeissiLetter)
    let twitterNews = [];
    try {
      const tweets = await fetchLatestTweets();
      if (tweets && tweets.length > 0) {
        twitterNews = tweets.map(t => ({
          source: "KobeissiLetter (Twitter)",
          title: t.content.substring(0, 100),
          snippet: t.content,
          link: t.link,
          date: t.date
        })).filter(t => isBreakingNews(t.title, t.snippet));
        console.log(`🐦 Twitter: ${twitterNews.length} breaking news items after filter`);
      }
    } catch (err) {
      console.warn("⚠️ Twitter fetch failed in macro analyzer:", err.message);
    }

    // 2. Fetch Reuters
    let reutersNews = [];
    try {
      const reuters = await fetchReutersFinance();
      if (reuters && reuters.length > 0) {
        reutersNews = reuters.map(r => ({
          source: "Reuters Business Finance",
          title: r.title,
          snippet: r.snippet,
          link: r.link,
          expandedContent: r.expandedContent
        })).filter(r => isBreakingNews(r.title, r.snippet));
        console.log(`📰 Reuters: ${reutersNews.length} breaking news items after filter`);
      }
    } catch (err) {
      console.warn("⚠️ Reuters fetch failed in macro analyzer:", err.message);
    }

    // Combine and limit to top 1 total (to avoid rate limits)
    const allNews = [...twitterNews, ...reutersNews].slice(0, 1);

    if (allNews.length === 0) {
      console.log("ℹ️ No breaking macro news found after filtering.");
      return [];
    }

    console.log(`🎯 Total breaking news to analyze: ${allNews.length}`);

    // 3. Analyze each with AI
    const analyzedNews = [];
    for (const news of allNews) {
      console.log(`🤖 Analyzing: ${news.title.substring(0, 50)}...`);
      const analysis = await analyzeMacroNewsWithAI(news);
      if (analysis) {
        analyzedNews.push(analysis);
      }
      // Delay between analysis to avoid rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return analyzedNews;

  } catch (error) {
    console.error("❌ Macro news analyzer error:", error.message);
    return [];
  }
}

async function broadcastMacroNewsAnalysis() {
  try {
    const { Client, GatewayIntentBits } = require("discord.js");
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });

    // Token already set in environment
    await client.login(process.env.DISCORD_TOKEN);

    const analyses = await fetchAndAnalyzeMacroNews();

    if (analyses.length === 0) {
      console.log("ℹ️ No macro news analysis to broadcast.");
      await client.destroy();
      return;
    }

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error("❌ Target channel not found:", CHANNEL_ID);
      await client.destroy();
      return;
    }

    for (const analysis of analyses) {
      // Truncate analysis if too long for Discord embed description (max 4096)
      let description = analysis.analysis || "*Analisis tidak tersedia*";
      if (description.length > 4000) {
        description = description.substring(0, 3997) + "...";
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎯 BREAKING MACRO ANALYSIS`)
        .setColor("#e74c3c")
        .setDescription(description)
        .addFields(
          { name: "📰 Headline", value: analysis.title.substring(0, 256), inline: false },
          { name: "📰 Source", value: analysis.source, inline: true },
          { name: "🔗 Link", value: analysis.link ? `[Baca](${analysis.link})` : "N/A", inline: true },
          { name: "🕒 Timestamp", value: new Date(analysis.timestamp).toLocaleString("id-ID"), inline: false }
        )
        .setTimestamp()
        .setFooter({ text: "Critical Thinking Macro Desk | Hunter Bot" });

      try {
        await channel.send({ embeds: [embed] });
        console.log(`📡 Broadcasted macro analysis: ${analysis.title.substring(0, 30)}... (analysis length: ${analysis.analysis?.length || 0})`);
      } catch (discordErr) {
        console.error("❌ Failed to send embed:", discordErr.message);
        // Try sending as plain text fallback
        await channel.send(`**BREAKING MACRO ANALYSIS**\n\n${analysis.analysis}\n\nSource: ${analysis.source}\nLink: ${analysis.link || 'N/A'}`);
      }

      // Delay between broadcasts
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await client.destroy();
    console.log("✅ Macro news broadcast completed.");

  } catch (error) {
    console.error("❌ Broadcast macro news error:", error.message);
  }
}

// Load cache on startup
loadCache();

module.exports = {
  fetchAndAnalyzeMacroNews,
  broadcastMacroNewsAnalysis,
  isBreakingNews,
  analyzeMacroNewsWithAI
};
