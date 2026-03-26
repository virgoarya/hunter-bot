const axios = require("axios");

// Multiple User-Agents to rotate
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
];

function getProxyAgent() {
  try {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxyUrl) {
      // Lazy require to avoid dependency if not used
      const { HttpsProxyAgent } = require('https-proxy-agent');
      console.log(`🔐 Using proxy: ${proxyUrl}`);
      return new HttpsProxyAgent(proxyUrl);
    }
  } catch (e) {
    // https-proxy-agent not installed or proxy invalid
    if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
      console.warn("⚠️ Proxy configured but https-proxy-agent not installed. Install with: npm install https-proxy-agent");
    }
  }
  return undefined;
}

function generateHeaders(uaIndex = 0) {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  return {
    "User-Agent": ua,
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.babypips.com/economic-calendar",
    "Origin": "https://www.babypips.com",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Priority": "u=1, i",
    "Sec-Ch-Ua": `"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"`,
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "DNT": "1",
    "X-Requested-With": "XMLHttpRequest"
  };
}

async function fetchBabyPipsCalendar(retries = 3) {
  const url = "https://www.babypips.com/economic-calendar?format=json";
  const proxyAgent = getProxyAgent();

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Pre-request delay for every attempt (randomized)
      let delayMs = 0;
      if (attempt === 0) {
        delayMs = Math.random() * 2000; // 0-2s random delay before first attempt
      } else {
        const baseDelay = Math.min(2000 * Math.pow(1.5, attempt), 10000);
        delayMs = baseDelay + Math.random() * 1000;
        console.log(`🔄 Retrying BabyPips fetch (attempt ${attempt + 1}/${retries + 1}) after ${Math.round(delayMs)}ms...`);
      }
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.log("🍼 Fetching economic data from BabyPips...");
      }

      // Rotate User-Agent on each attempt
      const requestHeaders = {
        ...generateHeaders(attempt),
        "Cookie": "session_visited=true; accepted_cookies=true"
      };

      const config = {
        headers: requestHeaders,
        timeout: 20000,
        maxRedirects: 10,
        decompress: true,
        responseType: 'text' // Get as text to parse manually, avoids some issues
      };
      if (proxyAgent) {
        config.httpAgent = proxyAgent;
        config.httpsAgent = proxyAgent;
      }

      const response = await axios.get(url, config);

      if (response.status === 403) {
        const body = (response.data || '').toLowerCase();
        if (body.includes('cloudflare') || body.includes('attention required') || body.includes('challenge')) {
          throw new Error(`HTTP 403: Cloudflare anti-bot challenge detected`);
        }
        throw new Error(`HTTP ${response.status}: Forbidden - Access denied`);
      }

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: Unexpected status`);
      }

      // Try to parse JSON
      let data;
      try {
        data = JSON.parse(response.data);
      } catch (parseErr) {
        console.warn("⚠️ BabyPips returned non-JSON response (likely HTML error page)");
        console.log("📋 Content-Type:", response.headers['content-type']);
        if (attempt < retries) continue;
        return [];
      }

      if (!data || !Array.isArray(data.events)) {
        console.warn("⚠️ BabyPips returned invalid JSON structure.");
        console.log("📋 Response keys:", Object.keys(data || {}));
        return [];
      }

      // Map BabyPips format to our standard format
      const events = data.events.map(e => {
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
        const { status } = error.response;

        if (status === 403 || status === 429) {
          const isRateLimit = status === 429;
          const errorMsg = isRateLimit
            ? `Rate limited (429) by BabyPips`
            : `Forbidden (403) - Cloudflare/anti-bot block`;

          console.warn(`⚠️ ${errorMsg}`);

          if (attempt < retries) {
            continue;
          } else {
            console.error(`❌ BabyPips scraper failed after ${retries + 1} attempts: ${errorMsg}`);
            return [];
          }
        }
      }

      // Retryable errors: network issues, timeouts, JSON parse errors
      const isRetryable = (
        error.code === 'ECONNABORTED' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.toLowerCase().includes('timeout') ||
        error.message?.toLowerCase().includes('json')
      );

      if (attempt < retries && isRetryable) {
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
