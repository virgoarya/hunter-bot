const { getAdaptiveThresholds } = require("./adaptiveThresholds");
const { getSeasonalTendency } = require("./seasonality");
const { DEFAULTS } = require("../config/thresholdDefaults");

function buildBias(macro, regimeObj, thresholds = {}) {
  const currentMonth = new Date().getMonth();
  const seasonal = getSeasonalTendency(currentMonth);

  if (!macro) return { usdBias: "N/A", goldBias: "N/A", equityBias: "N/A", oilBias: "N/A", seasonality: seasonal };

  // Get Adaptive Thresholds (with centralized defaults as fallback)
  // biasEngine uses VIX.elevated (22) as "high" — triggers bias shift earlier than regime panic (28)
  const yTh = getAdaptiveThresholds("US10Y", { high: DEFAULTS.US10Y.high, low: DEFAULTS.US10Y.low, mean: DEFAULTS.US10Y.mean });
  const vTh = getAdaptiveThresholds("VIX", { high: DEFAULTS.VIX.elevated, low: DEFAULTS.VIX.low, mean: DEFAULTS.VIX.mean });
  const rTh = getAdaptiveThresholds("RealYield", { high: DEFAULTS.RealYield.high, low: DEFAULTS.RealYield.low, mean: DEFAULTS.RealYield.mean });

  const dTh = { dxyHigh: DEFAULTS.DXY.high, dxyLow: DEFAULTS.DXY.low };
  const th = { ...yTh, ...vTh, ...rTh, ...dTh, ...thresholds };

  const dxy = macro.DXY?.close ?? 0;
  const vix = macro.VIX?.close ?? 0;
  const us10y = macro.US10Y?.close ?? 0;
  const realYield = macro.RealYield?.close ?? 0;
  const nasdaq = macro.NASDAQ?.close;

  // ON RRP liquidity signal
  const repoData = macro.RepoData;
  const repoChange = repoData && !repoData.error ? parseFloat(repoData.changePercent) || 0 : 0;

  let usdBias = "Netral", goldBias = "Netral", equityBias = "Netral";
  const regime = regimeObj?.regime ?? "";

  // === 1. USD BIAS (Carry vs Safety) ===
  if (us10y > th.high || regime.includes("Kepanikan") || regime.includes("Tekanan")) {
    usdBias = (regime.includes("Kepanikan") || regime.includes("Tekanan")) ? "Strong Bullish" : "Bullish";
  } else if (us10y < th.low && dxy < th.dxyLow) {
    usdBias = "Bearish";
  }

  // === 2. EQUITY BIAS (Growth vs Stress) ===
  if (nasdaq) {
    if (regime.includes("Reflasi") || regime.includes("Goldilocks") || regime.includes("Pertumbuhan")) {
      equityBias = "Bullish";
    } else if (regime.includes("Stagflasi") || regime.includes("Goncangan") || regime.includes("Kepanikan") || vix > th.high) {
      equityBias = "Bearish";
    }
  } else if (vix > th.high) {
    equityBias = "Bearish";
  }

  // === 3. GOLD BIAS (Real Yields & Safe Haven) ===
  const isSafeHavenRegime = regime.includes("Stagflasi") || regime.includes("Goncangan");
  const isUSDStrong = usdBias.includes("Bullish");

  if (realYield < th.low || isSafeHavenRegime) {
    goldBias = "Bullish";
    if (repoChange < -5) goldBias = "Netral / Rotasi";
  } else if (realYield > th.high || (isUSDStrong && !isSafeHavenRegime)) {
    // USD Kuat + Yield Tinggi = Musuh Emas (prioritas di atas Safe Haven biasa)
    goldBias = isUSDStrong ? "Strong Bearish" : "Bearish";
  } else if (regime.includes("Kepanikan")) {
    goldBias = "Netral / Volatil";
  } else if (repoChange > 5 && !isUSDStrong) {
    // Hanya Slight Bullish jika USD tidak sedang mendominasi
    goldBias = goldBias === "Netral" ? "Slight Bullish" : goldBias;
  }

  // === 4. EQUITY BIAS ON RRP MODIFIER ===
  if (repoChange < -5 && equityBias === "Netral") {
    equityBias = "Slight Bullish";
  } else if (repoChange > 10 && equityBias === "Netral") {
    equityBias = "Slight Bearish";
  }

  // === 5. SEASONAL MODIFIER (Tilt neutral bias based on month) ===
  if (usdBias === "Netral" && seasonal.usd !== "Neutral") {
    usdBias = `Slight ${seasonal.usd} (Musiman)`;
  }
  if (goldBias === "Netral" && seasonal.gold !== "Neutral") {
    goldBias = `Slight ${seasonal.gold} (Musiman)`;
  }
  if (equityBias === "Netral" && seasonal.equity !== "Neutral") {
    equityBias = `Slight ${seasonal.equity} (Musiman)`;
  }

  // === 6. OIL BIAS (Inflation Proxy & Growth Indicator) ===
  const oilChange = parseFloat(macro.OIL?.change) || 0;
  let oilBias = "Netral";

  if (regime.includes("Stagflasi") || (oilChange > 1 && us10y > th.high)) {
    oilBias = "Bullish";  // Inflasi panas → demand-push / supply-shock
  } else if (regime.includes("Reflasi") && oilChange > 0) {
    oilBias = "Bullish";  // Pertumbuhan ekonomi → demand naik
  } else if (regime.includes("Goncangan") || regime.includes("Kepanikan")) {
    oilBias = "Bearish";  // Ketakutan resesi → demand destruction
  } else if (oilChange < -2) {
    oilBias = "Bearish";  // Momentum turun tajam
  }

  return { usdBias, goldBias, equityBias, oilBias, seasonality: seasonal };
}

module.exports = { buildBias };

