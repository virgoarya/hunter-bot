const { getAdaptiveThresholds } = require("./adaptiveThresholds");
const { getSeasonalTendency } = require("./seasonality");

function buildBias(macro, regimeObj, thresholds = {}) {
  const currentMonth = new Date().getMonth();
  const seasonal = getSeasonalTendency(currentMonth);

  if (!macro) return { usdBias: "N/A", goldBias: "N/A", equityBias: "N/A", seasonality: seasonal };

  // Get Adaptive Thresholds
  const yTh = getAdaptiveThresholds("US10Y", { high: 4.2, low: 3.8, mean: 4.0 });
  const vTh = getAdaptiveThresholds("VIX", { high: 22, low: 16, mean: 19 });
  const rTh = getAdaptiveThresholds("RealYield", { high: 1.9, low: 1.4, mean: 1.65 });

  const dTh = { dxyHigh: 100.2, dxyLow: 98.8 };
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

  return { usdBias, goldBias, equityBias, seasonality: seasonal };
}

module.exports = { buildBias };

