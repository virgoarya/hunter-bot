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

async function fetchFREDSeries(seriesId, alias) {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=2`;

    const response = await axios.get(url, { timeout: 10000 });
    const obs = response.data.observations;

    if (!obs || obs.length === 0) return null;

    const value = obs[0].value;
    if (!value || value === "." || isNaN(parseFloat(value))) {
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

    return {
      symbol: alias,
      close: current,
      change: change
    };
  } catch (error) {
    console.error(`FRED ${alias} error:`, error.message);
    return null;
  }
}

module.exports = {
  updateMacroData,
  getMacroState,
};
