const { getAdaptiveThresholds } = require("./adaptiveThresholds");
const { DEFAULTS } = require("../config/thresholdDefaults");

function classifyRegime(state) {
  if (!state?.DXY || !state?.US10Y || !state?.NASDAQ || !state?.GOLD || !state?.VIX) {
    return {
      regime: "Data Tidak Lengkap",
      description: "Macro state belum siap untuk analisis institusional."
    };
  }

  // Get Adaptive Thresholds (with centralized defaults as fallback)
  const vTh = getAdaptiveThresholds("VIX", { high: DEFAULTS.VIX.high, veryHigh: DEFAULTS.VIX.veryHigh, low: DEFAULTS.VIX.low, mean: DEFAULTS.VIX.mean });
  const yTh = getAdaptiveThresholds("US10Y", { high: DEFAULTS.US10Y.high, low: DEFAULTS.US10Y.low, mean: DEFAULTS.US10Y.mean });
  const dTh = getAdaptiveThresholds("DXY", { high: DEFAULTS.DXY.high, low: DEFAULTS.DXY.low, mean: DEFAULTS.DXY.mean });

  const dxy = state.DXY.close;
  const us10y = state.US10Y.close;
  const vix = state.VIX.close;

  // Deteksi Perubahan
  const nasdaqChange = parseFloat(state.NASDAQ.change) || 0;
  const goldChange = parseFloat(state.GOLD.change) || 0;

  // ON RRP liquidity signal
  const repoData = state.RepoData;
  const repoChange = repoData && !repoData.error ? parseFloat(repoData.changePercent) || 0 : 0;
  const isRepoRiskOff = repoChange > 5;
  const isRepoRiskOn = repoChange < -5;

  // === 1. SYSTEMIC PANIC (Adaptive VIX Driven) ===
  if (vix > vTh.veryHigh || (vix > vTh.high && isRepoRiskOff)) {
    return {
      regime: "Kepanikan Sistemik 🚨",
      description: `Ekspansi volatilitas ekstrem (VIX > ${vTh.high.toFixed(1)}). Likuidasi paksa di semua kelas aset.` +
        (isRepoRiskOff ? " ON RRP meningkat — institusi berlindung di The Fed." : "")
    };
  }

  // === 2. STAGFLATIONARY STRESS ===
  if (us10y > yTh.high && nasdaqChange < -0.5 && goldChange > 0) {
    return {
      regime: "Stagflasi ⚠️",
      description: `Tekanan inflasi (Yield > ${yTh.high.toFixed(2)}%) merusak valuasi ekuitas. Emas dicari sebagai pelindung nilai.`
    };
  }

  // === 3. DEFLATIONARY SHOCK ===
  if (us10y < yTh.low && nasdaqChange < -0.8) {
    return {
      regime: "Goncangan Deflasi 📉",
      description: `Yield jatuh di bawah ${yTh.low.toFixed(2)}% menunjukkan ketakutan resesi mendominasi. Flight to safety.`
    };
  }

  // === 4. REFLATION / HEALTHY GROWTH ===
  if ((us10y > yTh.mean && nasdaqChange > 0.3 && vix < vTh.mean) || (nasdaqChange > 0.3 && vix < vTh.high && isRepoRiskOn)) {
    return {
      regime: "Reflasi 🚀",
      description: "Pertumbuhan ekonomi optimis. Akumulasi aset berisiko." +
        (isRepoRiskOn ? " ON RRP menurun — likuiditas mengalir ke pasar." : "")
    };
  }

  // === 5. GOLDILOCKS ===
  if (vix < vTh.low && us10y > yTh.low && us10y < yTh.high && nasdaqChange >= 0) {
    return {
      regime: "Goldilocks ✨",
      description: `VIX rendah (<${vTh.low.toFixed(1)}) & Yield stabil. Kondisi ideal untuk aset berisiko.`
    };
  }

  // === 6. DEFENSIVE ===
  if (dxy > dTh.high || vix > vTh.mean || (isRepoRiskOff && vix > vTh.low)) {
    const reasons = [];
    if (dxy > dTh.high) reasons.push(`DXY > ${dTh.high.toFixed(1)}`);
    if (vix > vTh.mean) reasons.push(`VIX > ${vTh.mean.toFixed(1)}`);
    if (isRepoRiskOff) reasons.push("ON RRP meningkat");

    return {
      regime: "Defensif 🛡️",
      description: `Pengetatan likuiditas detect via (${reasons.join(", ")}). Institusi meningkatkan kepemilikan kas.`
    };
  }

  return {
    regime: "Transisi Makro",
    description: "Korelasi antar-pasar sedang mencari keseimbangan baru. Belum ada tren dominan."
  };
}

module.exports = { classifyRegime };
