const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { fetchBabyPipsCalendar } = require("./babypipsScraper");

const CACHE_FILE = path.join(__dirname, "../calendar_cache.json");
const CACHE_MS = 15 * 60 * 1000;
const AV_CACHE_MS = 60 * 60 * 1000; // 1 hour for AlphaVantage to stay under 25/day

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

let calendarCache = loadCache();

let avCalendarCache = {
  data: [],
  updatedAt: 0,
  rateLimitedUntil: 0
};

let pendingCalendarFetch = null;

async function fetchAlphaVantageMacroNews(limit = 8) {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) return [];

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

    const feed = Array.isArray(response.data?.feed) ? response.data.feed : [];

    return feed.slice(0, limit).map((item) => ({
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
  } catch (error) {
    console.error("AlphaVantage news error:", error.message);
    return [];
  }
}

async function fetchAlphaVantageCalendar(forceRefresh = false) {
  const now = Date.now();
  
  if (now < avCalendarCache.rateLimitedUntil) {
    console.warn(`🛑 AlphaVantage Rate Limit Active. skipping fetch for ${Math.round((avCalendarCache.rateLimitedUntil - now) / 1000 / 60)} minutes.`);
    return avCalendarCache.data;
  }

  const FORCE_COOLDOWN_MS = 10 * 60 * 1000;
  if (forceRefresh && now - avCalendarCache.updatedAt < FORCE_COOLDOWN_MS && avCalendarCache.data.length > 0) {
    console.log("⏳ AV Force Refresh Cooldown: Using cache instead of hitting API.");
    return avCalendarCache.data;
  }

  if (!forceRefresh && now - avCalendarCache.updatedAt < AV_CACHE_MS && avCalendarCache.data.length > 0) {
    return avCalendarCache.data;
  }

  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) return [];

    console.log("📡 Fetching Actuals from AlphaVantage Calendar...");
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

      avCalendarCache = { data, updatedAt: now, rateLimitedUntil: 0 };
      return data;
    } else if (response.data?.Information || response.data?.Note) {
      const info = response.data.Information || response.data.Note;
      console.warn("⚠️ AlphaVantage API Info:", info);
      if (info.includes("rate limit") || info.includes("higher than your plan")) {
        avCalendarCache.rateLimitedUntil = now + (30 * 60 * 1000);
        console.warn("🚫 AV Rate Limit Triggered. Cooldown set for 30 minutes.");
      }
    }
    return avCalendarCache.data;
  } catch (error) {
    console.error("AlphaVantage calendar error:", error.message);
    return avCalendarCache.data;
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

  const FE_COOLDOWN_MS = 2 * 60 * 1000;
  if (forceRefresh && now - calendarCache.updatedAt < FE_COOLDOWN_MS && calendarCache.data.length > 0) {
    console.warn(`⏳ FairEconomy Cooldown Active. Bypass forceRefresh ditahan selama sisa ${(FE_COOLDOWN_MS - (now - calendarCache.updatedAt)) / 1000} detik.`);
    return calendarCache.data;
  }

  if (!forceRefresh && now - calendarCache.updatedAt < CACHE_MS && calendarCache.data.length > 0) {
    return calendarCache.data;
  }

  try {
    const majorCountries = ["USD", "GBP", "EUR", "JPY", "CHF", "CAD"];

    // 1. Fetch BabyPips (PRIMARY Skeleton)
    let bpCal = [];
    try {
      const allBp = await fetchBabyPipsCalendar();
      // Filter: Only major countries AND High Impact (as requested)
      bpCal = allBp.filter(e => {
          const name = e.event.toUpperCase();
          const isMajor = majorCountries.includes(e.country);
          const isHigh = e.impact === "High";
          
          // Filter out redundant CPI index values (keep "Inflation Rate")
          if (e.country === "USD" && (name === "CPI" || name === "CPI S.A")) return false;
          
          return isMajor && isHigh;
      });
    } catch (bpErr) {
      console.warn("⚠️ BabyPips primary fetch skipping:", bpErr.message);
    }

    // 2. Fetch FairEconomy (FALLBACK Skeleton)
    let feData = [];
    const feUrl = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
    try {
      console.log("📅 Fetching Economic Calendar from FairEconomy Mirror...");
      const feRes = await axios.get(feUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        timeout: 10000
      });
      if (Array.isArray(feRes.data)) {
        feData = feRes.data;
      }
    } catch (err) {
      console.warn("⚠️ FairEconomy mirror unreachable/limited:", err.message);
    }

    // 3. Determine Base Skeleton (BabyPips Priority)
    let events = [];
    if (bpCal.length > 0) {
      console.log(`🍼 Using BabyPips as primary skeleton (${bpCal.length} High-Impact events).`);
      events = bpCal;
    } else if (feData.length > 0) {
      console.log(`📊 Fallback: Using FairEconomy as skeleton (${feData.length} events).`);
      // Re-filter FE for Major Countries and High Impact
      events = feData.filter(e => majorCountries.includes(e.country) && e.impact === "High").map(e => ({
        type: "event",
        source: "FairEconomy",
        date: e.date,
        country: e.country,
        event: e.title,
        impact: e.impact,
        forecast: e.forecast || "N/A",
        previous: e.previous || "N/A",
        actual: e.actual || "N/A"
      }));
    } else {
      console.warn("❌ No data from FE or BP. Using existing cache.");
      return calendarCache.data;
    }

    // 4. Supplement with AlphaVantage (Actuals backup)
    let avCal = [];
    try {
      if (forceRefresh || now - avCalendarCache.updatedAt > AV_CACHE_MS) {
        avCal = await fetchAlphaVantageCalendar(forceRefresh);
      }
    } catch (avErr) { }

    const processedEvents = events.map(baseEvent => {
      const feDateStr = baseEvent.date.split("T")[0];

      // A. Supplement from AlphaVantage
      if (baseEvent.actual === "N/A" && avCal.length > 0) {
        const avMatch = avCal.find(av => {
          if (!av.date || !av.event) return false;
          return av.date === feDateStr && (
            baseEvent.event.toUpperCase().includes(av.event.toUpperCase()) ||
            av.event.toUpperCase().includes(baseEvent.event.toUpperCase())
          );
        });
        if (avMatch?.actual && avMatch.actual !== ".") baseEvent.actual = avMatch.actual;
      }

      // B. Supplement from FairEconomy (if needed)
      if (baseEvent.source === "BabyPips" && baseEvent.actual === "N/A" && feData.length > 0) {
          const feMatch = feData.find(fe => {
              if (!fe.date || !fe.title) return false;
              const dMatch = fe.date.split("T")[0] === feDateStr;
              const nMatch = baseEvent.event.toUpperCase().includes(fe.title.toUpperCase()) || fe.title.toUpperCase().includes(baseEvent.event.toUpperCase());
              return dMatch && nMatch;
          });
          if (feMatch?.actual && feMatch.actual !== "N/A") baseEvent.actual = feMatch.actual;
      }

      return baseEvent;
    });

    // Small delay before fetching news to avoid 1s burst limit if just fetched calendar
    await new Promise(r => setTimeout(r, 1200));
    const avNews = await fetchAlphaVantageMacroNews(5);
    const merged = [...processedEvents, ...avNews];
    
    calendarCache = { data: merged, updatedAt: now };
    saveCache(merged);

    console.log(`✅ Calendar updated: ${processedEvents.length} events.`);
    return merged;

  } catch (error) {
    console.error("Calendar fetch error:", error.message);
    return calendarCache.data;
  }
}

module.exports = { fetchEconomicCalendar };
