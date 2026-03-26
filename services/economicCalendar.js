const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { fetchBabyPipsCalendar } = require("./babypipsScraper");

const CACHE_FILE = path.join(__dirname, "../calendar_cache.json");
const AV_CACHE_FILE = path.join(__dirname, "../data/av_cache.json");

const CACHE_MS = 15 * 60 * 1000;
const AV_CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours for AlphaVantage to stay under 25/day
const AV_HARD_COOLDOWN_MS = 30 * 60 * 1000; // Minimum 30 mins between ANY AV call

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      console.log(`📂 Loaded ${parsed.data.length} calendar events from disk cache.`);
      return parsed;
    }
  } catch (err) {
    console.error("Cache load error:", err.message);
  }
  return { data: [], updatedAt: 0 };
}

function saveCache(data) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ data, updatedAt: Date.now() }));
  } catch (err) {
    console.error("Cache save error:", err.message);
  }
}

function loadAVCache() {
    try {
        if (fs.existsSync(AV_CACHE_FILE)) {
            const raw = fs.readFileSync(AV_CACHE_FILE, "utf8");
            const data = JSON.parse(raw);
            // Migrate old cache format (single lastCallTime) to separate timestamps
            if (data.lastCallTime && !data.lastCalendarCallTime && !data.lastNewsCallTime) {
                data.lastCalendarCallTime = data.lastCallTime;
                data.lastNewsCallTime = data.lastCallTime;
                delete data.lastCallTime;
            }
            return data;
        }
    } catch (e) {
        console.warn("AV Cache load error:", e.message);
    }
    return {
        calendar: { data: [], updatedAt: 0 },
        news: { data: [], updatedAt: 0 },
        rateLimitedUntil: 0,
        lastCalendarCallTime: 0,
        lastNewsCallTime: 0
    };
}

function saveAVCache(cache) {
    try {
        const dir = path.dirname(AV_CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(AV_CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (e) {
        console.warn("AV Cache save error:", e.message);
    }
}

let calendarCache = loadCache();
let avCache = loadAVCache();

let pendingCalendarFetch = null;

async function fetchAlphaVantageMacroNews(limit = 8) {
  const now = Date.now();

  // 1. Check rate limit
  if (now < avCache.rateLimitedUntil) return avCache.news.data;

  // 2. Check Cache TTL (6 hours)
  if (now - avCache.news.updatedAt < AV_CACHE_MS && avCache.news.data.length > 0) {
      return avCache.news.data;
  }

  // 3. Check Hard Cooldown (30 mins) - separate from calendar
  if (now - (avCache.lastNewsCallTime || 0) < AV_HARD_COOLDOWN_MS) {
      console.log("⏳ AV News: Skipping due to hard cooldown.");
      return avCache.news.data;
  }

  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) return [];

    console.log("📡 Fetching Macro News from AlphaVantage...");
    avCache.lastNewsCallTime = now;
    saveAVCache(avCache);

    const response = await axios.get("https://www.alphavantage.co/query", {
      params: {
        function: "NEWS_SENTIMENT",
        topics: "economy_macro,financial_markets",
        sort: "LATEST",
        limit,
        apikey: apiKey
      },
      timeout: 10000
    });

    // Check for rate limit info in JSON
    const info = response.data?.Information || response.data?.Note;
    if (info && (info.includes("rate limit") || info.includes("25 requests per day"))) {
        console.warn("🛑 AlphaVantage Rate Limit Detected (News). Hibernating for 12 hours.");
        avCache.rateLimitedUntil = now + (12 * 60 * 60 * 1000);
        saveAVCache(avCache);
        return avCache.news.data;
    }

    const feed = Array.isArray(response.data?.feed) ? response.data.feed : [];
    const newsData = feed.slice(0, limit).map((item) => ({
      type: "news",
      source: "AlphaVantage",
      date: item.time_published || null,
      country: "Global",
      event: item.title || "Macro market update",
      actual: item.overall_sentiment_label || "N/A",
      forecast: "N/A",
      previous: "N/A",
      url: item.url || null
    }));

    if (newsData.length > 0) {
        avCache.news = { data: newsData, updatedAt: now };
        saveAVCache(avCache);
    }

    return newsData;
  } catch (error) {
    console.warn("AlphaVantage news error:", error.message);
    return avCache.news.data;
  }
}

async function fetchAlphaVantageCalendar(forceRefresh = false) {
  const now = Date.now();

  // 1. Check rate limit hibernation
  if (now < avCache.rateLimitedUntil) {
    console.warn(`🛑 AlphaVantage in hibernation. skipping fetch for ${Math.round((avCache.rateLimitedUntil - now) / 1000 / 60)} minutes.`);
    return avCache.calendar.data;
  }

  // 2. Check Cache TTL (6 hours)
  if (!forceRefresh && now - avCache.calendar.updatedAt < AV_CACHE_MS && avCache.calendar.data.length > 0) {
    return avCache.calendar.data;
  }

  // 3. Check Hard Cooldown (30 mins) - separate from news fetch
  // Allow bypass if forceRefresh is true OR we need actual values urgently
  // (e.g., when FairEconomy/BabyPips failed to provide actuals)
  const needsActualsUrgently = false; // Will be set by caller if needed
  const canBypassCooldown = forceRefresh || needsActualsUrgently;
  if (!canBypassCooldown && now - (avCache.lastCalendarCallTime || 0) < AV_HARD_COOLDOWN_MS) {
      console.log("⏳ AV Calendar: Skipping due to hard cooldown.");
      return avCache.calendar.data;
  }

  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) return [];

    console.log("📡 Fetching Actuals from AlphaVantage Calendar...");
    avCache.lastCalendarCallTime = now;
    saveAVCache(avCache);

    const response = await axios.get("https://www.alphavantage.co/query", {
      params: {
        function: "ECONOMIC_CALENDAR",
        apikey: apiKey
      },
      timeout: 15000
    });

    if (typeof response.data === "string") {
      const lines = response.data.trim().split("\n");
      if (lines.length < 2) return [];

      const headers = lines[0].split(",").map(h => h.trim());
      const data = lines.slice(1).map(line => {
          const values = line.split(",");
          const entry = {};
          headers.forEach((h, i) => {
              const key = h.toLowerCase().trim();
              entry[key] = values[i]?.trim();
          });
          entry.date = entry.date || entry.time || entry.timestamp;
          entry.event = entry.event || entry.title;
          return entry;
      });

      avCache.calendar = { data, updatedAt: now };
      saveAVCache(avCache);
      return data;
    } else if (response.data?.Information || response.data?.Note) {
      const info = response.data.Information || response.data.Note;
      console.warn("⚠️ AlphaVantage API Info:", info);
      if (info.includes("rate limit") || info.includes("25 requests per day")) {
        avCache.rateLimitedUntil = now + (12 * 60 * 60 * 1000);
        saveAVCache(avCache);
        console.warn("🚫 AV Rate Limit Triggered. Hibernating for 12 hours.");
      }
    }
    return avCache.calendar.data;
  } catch (error) {
    console.error("AlphaVantage calendar error:", error.message);
    return avCache.calendar.data;
  }
}

async function fetchEconomicCalendar(forceRefresh = false) {
  if (pendingCalendarFetch) {
    console.log("⏳ Calendar fetch already in progress. Reusing existing request...");
    return pendingCalendarFetch;
  }

  pendingCalendarFetch = (async () => {
    try {
      return await _fetchEconomicCalendarInternal(forceRefresh);
    } finally {
      pendingCalendarFetch = null;
    }
  })();

  return pendingCalendarFetch;
}

async function _fetchEconomicCalendarInternal(forceRefresh = false) {
  const now = Date.now();

  // General cache TTL (15 min) - soft cache for normal requests
  if (!forceRefresh && now - calendarCache.updatedAt < CACHE_MS && calendarCache.data.length > 0) {
    return calendarCache.data;
  }

  try {
    const majorCountries = ["USD", "GBP", "EUR", "JPY", "CHF", "CAD"];

    // 1. Fetch BabyPips (PRIMARY - because it includes actual values after release)
    let bpCal = [];
    try {
      const allBp = await fetchBabyPipsCalendar();
      bpCal = allBp.filter(e => {
          const name = e.event.toUpperCase();
          const isMajor = majorCountries.includes(e.country);
          const isHigh = e.impact === "High";
          // Keep existing filter for specific events if needed
          return isMajor && isHigh;
      });
      console.log(`✅ BabyPips: ${bpCal.length} high-impact events retrieved`);
    } catch (bpErr) {
      console.warn("⚠️ BabyPips fetch failed:", bpErr.message);
    }

    // 2. Fetch FairEconomy (FALLBACK - if BabyPips fails or returns empty)
    let feData = [];
    if (bpCal.length === 0) {
      const feUrl = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
      try {
        console.log("📅 Fetching Economic Calendar from FairEconomy Mirror (fallback)...");
        const feRes = await axios.get(feUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*"
          },
          timeout: 10000
        });
        if (Array.isArray(feRes.data)) feData = feRes.data;
        console.log(`✅ FairEconomy fallback: ${feData.length} events retrieved`);
      } catch (err) {
        console.warn("⚠️ FairEconomy fetch failed:", err.message);
      }
    }

    // 3. Determine base events
    let events = [];
    if (bpCal.length > 0) {
      events = bpCal; // BabyPips already has actual values
    } else if (feData.length > 0) {
      events = feData.filter(e => majorCountries.includes(e.country) && e.impact === "High").map(e => ({
        type: "event",
        source: "FairEconomy",
        date: e.date,
        country: e.country,
        event: e.title,
        impact: e.impact,
        forecast: e.forecast || "N/A",
        previous: e.previous || "N/A",
        actual: e.actual || "N/A" // FairEconomy typically doesn't have actuals
      }));
    } else {
      console.warn("⚠️ Both BabyPips and FairEconomy failed, returning cached data");
      return calendarCache.data;
    }

    // 4. Supplement with AlphaVantage (6h Cache) for actual values
    // Only fetch AV calendar if we have events needing actuals AND we're not rate limited
    const eventsNeedingActuals = events.filter(e => e.actual === "N/A");
    const needsActualsUrgently = eventsNeedingActuals.length > 0;

    // Additional optimization: Only request AV if there are recent/future events
    // (skip old events that we don't need actuals for)
    const now = Date.now();
    const threeHoursAgo = now - (3 * 60 * 60 * 1000);
    const tomorrow = now + (24 * 60 * 60 * 1000);
    const recentOrFutureEvents = eventsNeedingActuals.filter(e => {
      try {
        const eventTime = new Date(e.date).getTime();
        return eventTime >= threeHoursAgo && eventTime <= tomorrow;
      } catch { return false; }
    });

    const shouldFetchAV = needsActualsUrgently && recentOrFutureEvents.length > 0;

    let avCal = [];
    if (shouldFetchAV) {
      avCal = await fetchAlphaVantageCalendar(forceRefresh || needsActualsUrgently);
    } else if (!shouldFetchAV && needsActualsUrgently) {
      console.log(`⏳ Skipping AlphaVantage fetch: ${eventsNeedingActuals.length} events need actuals but none are recent enough (within 3h).`);
    }

    const processedEvents = events.map(baseEvent => {
      if (baseEvent.actual === "N/A" && avCal?.length > 0) {
        const feDateStr = baseEvent.date.split("T")[0];
        const avMatch = avCal.find(av => {
          if (!av.date || !av.event) return false;
          return av.date === feDateStr && (baseEvent.event.toUpperCase().includes(av.event.toUpperCase()) || av.event.toUpperCase().includes(baseEvent.event.toUpperCase()));
        });
        if (avMatch?.actual && avMatch.actual !== ".") baseEvent.actual = avMatch.actual;
      }
      return baseEvent;
    });

    const avNews = await fetchAlphaVantageMacroNews(5);
    const merged = [...processedEvents, ...avNews];

    calendarCache = { data: merged, updatedAt: now };
    saveCache(merged);

    console.log(`✅ Calendar updated: ${processedEvents.length} events (+ ${avNews.length} news).`);
    return merged;

  } catch (error) {
    console.error("Calendar fetch error:", error.message);
    return calendarCache.data;
  }
}

module.exports = { fetchEconomicCalendar };
