const { getAdaptiveThresholds } = require("./adaptiveThresholds");

function classifyRegime(state) {
  if (!state?.DXY || !state?.US10Y || !state?.NASDAQ || !state?.GOLD || !state?.VIX) {
    return {
      regime: "Data Tidak Lengkap",
      description: "Macro state belum siap untuk analisis institusional."
    };
  }

  // Get Adaptive Thresholds
  const vTh = getAdaptiveThresholds("VIX", { high: 28, veryHigh: 35, low: 16, mean: 20 });
  const yTh = getAdaptiveThresholds("US10Y", { high: 4.2, low: 3.8, mean: 4.0 });
  const dTh = getAdaptiveThresholds("DXY", { high: 102, low: 100, mean: 101 });

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
    return {
      regime: "Defensif 🛡️",
      description: `Pengetatan likuiditas global (DXY > ${dTh.high.toFixed(1)}). Institusi meningkatkan kepemilikan kas.` +
        (isRepoRiskOff ? " ON RRP meningkat — dana kembali ke The Fed." : "")
    };
  }

  return {
    regime: "Transisi Makro",
    description: "Korelasi antar-pasar sedang mencari keseimbangan baru. Belum ada tren dominan."
  };
}

module.exports = { classifyRegime };