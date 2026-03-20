function buildBias(macro, regimeObj, thresholds = {}) {
  if (!macro) return { usdBias: "N/A", goldBias: "N/A", equityBias: "N/A" };

  const defaults = { dxyHigh: 101.5, dxyLow: 99.5, us10yHigh: 4.2, us10yLow: 3.8, vixHigh: 22, realLow: 1.4, realHigh: 1.9 };
  const th = { ...defaults, ...thresholds };

  const dxy = macro.DXY?.close ?? 0;
  const vix = macro.VIX?.close ?? 0;
  const us10y = macro.US10Y?.close ?? 0;
  const realYield = macro.RealYield?.close ?? 0;
  const nasdaq = macro.NASDAQ?.close;

  let usdBias = "Netral", goldBias = "Netral", equityBias = "Netral";
  const regime = regimeObj?.regime ?? "";

  // === 1. USD BIAS (Carry vs Safety) ===
  // Bullish jika Yields tinggi (Carry) atau saat Kepanikan/Tekanan (Safe Haven).
  if (us10y > th.us10yHigh || regime.includes("Kepanikan") || regime.includes("Tekanan")) {
    usdBias = (regime.includes("Kepanikan") || regime.includes("Tekanan")) ? "Strong Bullish" : "Bullish";
  } else if (us10y < th.us10yLow && dxy < th.dxyLow) {
    usdBias = "Bearish";
  }

  // === 2. EQUITY BIAS (Growth vs Stress) ===
  if (nasdaq) {
    if (regime.includes("Reflasi") || regime.includes("Goldilocks") || regime.includes("Pertumbuhan")) {
      equityBias = "Bullish";
    } else if (regime.includes("Stagflasi") || regime.includes("Goncangan") || regime.includes("Kepanikan") || vix > th.vixHigh) {
      equityBias = "Bearish";
    }
  } else if (vix > 20) {
    equityBias = "Bearish";
  }

  // === 3. GOLD BIAS (Real Yields & Safe Haven) ===
  // Sensitivitas tinggi terhadap Real Yields (Biaya Peluang).
  if (realYield < th.realLow || regime.includes("Stagflasi") || regime.includes("Goncangan")) {
    goldBias = "Bullish";
  } else if (realYield > th.realHigh && usdBias === "Bullish") {
    goldBias = "Bearish";
  } else if (regime.includes("Kepanikan")) {
    goldBias = "Netral / Volatil";
  }

  return { usdBias, goldBias, equityBias };
}

module.exports = { buildBias };
