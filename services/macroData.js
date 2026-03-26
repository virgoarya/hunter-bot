require("dotenv").config();
const axios = require("axios");
const { fetchYahooPrice } = require("./yahooFinance");
const { fetchStooqPrice } = require("./stooqService");
const { fetchRepoData } = require("./repoService");

let macroState = {};

async function fetchMacroIndicator(symbol) {
  try {
    const stooqData = await fetchStooqPrice(symbol);
    if (stooqData && Number.isFinite(stooqData.close)) {
      return stooqData;
    }
  } catch (error) {
    console.warn(`⚠️ Stooq failed for macro ${symbol}: ${error.message}`);
  }

  console.log(`⚠️ Falling back to Yahoo Finance for macro ${symbol}...`);
  return await fetchYahooPrice(symbol);
}

async function updateMacroData() {
  // Fetch macro instruments prioritizing Stooq
  const dxy = await fetchMacroIndicator("DXY");
  await new Promise((r) => setTimeout(r, 200));
  const nasdaq = await fetchMacroIndicator("NASDAQ");
  await new Promise((r) => setTimeout(r, 200));
  const gold = await fetchMacroIndicator("GOLD");
  await new Promise((r) => setTimeout(r, 200));
  const vix = await fetchMacroIndicator("VIX");
  await new Promise((r) => setTimeout(r, 200));
  const oil = await fetchMacroIndicator("OIL");

  // US10Y and Real Yield from FRED
  const us10y = await fetchFREDSeries("DGS10", "US10Y");
  const realYield = await fetchFREDSeries("DFII10", "RealYield");
  const ffr = await fetchFREDSeries("FEDFUNDS", "FFR");

  // ON RRP from NY Fed
  let repoData = null;
  try {
    repoData = await fetchRepoData();
  } catch (err) {
    console.warn("⚠️ Repo data fetch failed:", err.message);
  }

  const results = {
    DXY: dxy,
    NASDAQ: nasdaq,
    GOLD: gold,
    OIL: oil,
    US10Y: us10y,
    RealYield: realYield,
    FFR: ffr,
    VIX: vix,
    RepoData: repoData,
  };

  const isHealthy = !!(
    results.DXY &&
    results.NASDAQ &&
    results.US10Y &&
    results.GOLD &&
    results.VIX
  );

  macroState = {
    ...results,
    isHealthy,
    updatedAt: new Date(),
  };

  return macroState;
}

function getMacroState() {
  return macroState;
}

async function fetchFREDSeries(seriesId, alias, retries = 2) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=2`;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`🔄 Retrying FRED ${alias} (attempt ${attempt + 1}/${retries + 1}) after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.log(`📊 Fetching FRED ${alias} (${seriesId})...`);
      }

      const response = await axios.get(url, {
        timeout: 10000,
        // Add headers to avoid potential blocking
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      // Check for FRED API errors (status 500, 429, etc)
      if (response.status >= 500) {
        throw new Error(`FRED API server error: HTTP ${response.status}`);
      }

      const obs = response.data?.observations;

      if (!obs || obs.length === 0) {
        console.warn(`⚠️ FRED ${alias}: No observations returned`);
        return null;
      }

      const value = obs[0].value;
      if (!value || value === "." || isNaN(parseFloat(value))) {
        console.warn(`⚠️ FRED ${alias}: Invalid value`);
        return null;
      }

      const current = parseFloat(value);
      let change = "0.000";

      if (obs.length > 1) {
        const prev = parseFloat(obs[1].value);
        if (!isNaN(prev)) {
          change = (current - prev).toFixed(3);
        }
      }

      console.log(`✅ FRED ${alias}: ${current} (change: ${change})`);
      return {
        symbol: alias,
        close: current,
        change: change
      };

    } catch (error) {
      lastError = error;

      const status = error.response?.status;

      // Retry on 5xx errors and network issues
      const shouldRetry = (
        status >= 500 ||
        status === 429 ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        !error.response
      );

      if (shouldRetry && attempt < retries) {
        continue;
      }

      // Log detailed error on final failure
      console.error(`❌ FRED ${alias} failed after ${retries + 1} attempts:`);
      console.error(`   Error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
      return null;
    }
  }

  console.error(`❌ FRED ${alias} failed completely:`, lastError?.message);
  return null;
}

module.exports = {
  updateMacroData,
  getMacroState,
};
