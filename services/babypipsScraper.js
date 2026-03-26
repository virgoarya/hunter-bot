const axios = require("axios");

async function fetchBabyPipsCalendar(retries = 2) {
  const url = "https://www.babypips.com/economic-calendar?format=json";

  // Enhanced headers to mimic real browser and avoid 403
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.babypips.com/economic-calendar",
    "Origin": "https://www.babypips.com",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Priority": "u=1, i",
    "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"'
  };

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`🔄 Retrying BabyPips fetch (attempt ${attempt + 1}/${retries + 1}) after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.log("🍼 Fetching economic data from BabyPips...");
      }

      const response = await axios.get(url, {
        headers: headers,
        timeout: 15000,
        maxRedirects: 5,
        // Disable axios decompression to handle gzip properly
        decompress: true
      });

      if (response.status === 403) {
        throw new Error(`HTTP ${response.status}: Forbidden - Access denied by BabyPips`);
      }

      if (!response.data || !Array.isArray(response.data.events)) {
        console.warn("⚠️ BabyPips returned invalid JSON or empty events.");
        console.log("📋 Response status:", response.status);
        return [];
      }

      // Map BabyPips format to our standard format
      const events = response.data.events.map(e => {
        let eventDate = e.starts_at;
        if (typeof eventDate === "number") {
            eventDate = new Date(eventDate * 1000).toISOString();
        } else if (!eventDate) {
            eventDate = new Date().toISOString();
        }

        return {
          type: "event",
          source: "BabyPips",
          date: eventDate,
          country: e.currency_code,
          event: e.name,
          impact: mapImpact(e.impact),
          forecast: e.forecast || "N/A",
          previous: e.previous || "N/A",
          actual: e.actual || "N/A"
        };
      });

      console.log(`✅ BabyPips success: ${events.length} events retrieved`);
      return events;

    } catch (error) {
      lastError = error;

      if (error.response) {
        const { status, data } = error.response;

        if (status === 403 || status === 429) {
          const isRateLimit = status === 429;
          const errorMsg = isRateLimit
            ? `Rate limited (429) by BabyPips`
            : `Forbidden (403) -可能被Cloudflare或anti-bot memblokir`;

          console.warn(`⚠️ ${errorMsg}`);

          if (attempt < retries) {
            continue; // retry
          } else {
            console.error(`❌ BabyPips scraper failed after ${retries + 1} attempts: ${errorMsg}`);
            if (data) {
              console.error("📋 Response data (truncated):", data.substring(0, 500));
            }
            return [];
          }
        }
      }

      // Other errors (network, timeout, etc) - retryable
      if (attempt < retries && (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET' || !error.response)) {
        continue;
      }

      console.error("❌ BabyPips scraper error:", error.message);
      return [];
    }
  }

  console.error("❌ BabyPips scraper failed completely:", lastError?.message);
  return [];
}

function mapImpact(impact) {
  if (!impact) return "Low";
  const i = impact.toLowerCase();
  if (i === "high") return "High";
  if (i === "med" || i === "medium") return "Medium";
  return "Low";
}

module.exports = { fetchBabyPipsCalendar };
