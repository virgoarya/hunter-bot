const { getAdaptiveThresholds } = require("./adaptiveThresholds");
const { DEFAULTS } = require("../config/thresholdDefaults");

function detectIntent(state) {
  const dxy = state.DXY?.close;
  const yield10y = state.US10Y?.close;
  const nasdaq = state.NASDAQ?.close;
  const vix = state.VIX?.close;

  // Deteksi Perubahan Dinamis
  const nasdaqChange = parseFloat(state.NASDAQ?.change) || 0;
  const vixChange = parseFloat(state.VIX?.change) || 0;

  if (!state.isHealthy) {
    return {
      intent: "Data Tidak Mencukupi",
      description: "Niat pasar tidak jelas karena input makro tidak lengkap."
    };
  }

  // Get Adaptive Thresholds (synced with regime.js & biasEngine.js)
  const vTh = getAdaptiveThresholds("VIX", {
    high: DEFAULTS.VIX.derisking,        // 24
    low: DEFAULTS.VIX.low,               // 16
    mean: DEFAULTS.VIX.accumulation      // 20
  });
  const yTh = getAdaptiveThresholds("US10Y", {
    high: DEFAULTS.US10Y.yieldAbsorption, // 4.1
    low: DEFAULTS.US10Y.low,
    mean: DEFAULTS.US10Y.mean
  });

  // === 1. SYSTEMIC DE-RISKING (High Vol + Price Drop) ===
  if (vix > vTh.high || (vixChange > 12 && nasdaqChange < -0.8)) {
    return {
      intent: "De-risking Sistemik 🚨",
      description: `Institusi secara agresif mengurangi eksposur. VIX melampaui ambang de-risking (${vTh.high.toFixed(1)}).`
    };
  }

  // === 2. INSTITUTIONAL ACCUMULATION (Vix Down + Price Steady/Up) ===
  // "Quiet Buying" - Smart Money masuk kembali saat volatilitas mendingin.
  if (vixChange < -4 && nasdaqChange >= -0.2 && vix < vTh.mean) {
    return {
      intent: "Akumulasi Institusional 🏦",
      description: `Smart Money mulai masuk kembali. VIX di bawah ${vTh.mean.toFixed(1)} saat harga membangun basis dukungan.`
    };
  }

  // === 3. INSTITUTIONAL DISTRIBUTION (Price Weak + Vix still Low) ===
  // "Quiet Selling" - Institusi menjual ke ritel sebelum lonjakan volatilitas.
  if (nasdaqChange < -0.4 && vix < vTh.low) {
    return {
      intent: "Distribusi Institusional 📉",
      description: `Penjualan diam-diam oleh institusi. Harga melemah meskipun VIX masih tenang (< ${vTh.low.toFixed(1)}).`
    };
  }

  // === 4. YIELD ABSORPTION (Yields Up + Equities Resilience) ===
  // Pasar tetap kuat meskipun biaya modal naik.
  if (yield10y > yTh.high && nasdaqChange > -0.25) {
    return {
      intent: "Penyerapan Imbal Hasil 🔋",
      description: `Ekuitas menyerap kenaikan yield di atas ${yTh.high.toFixed(2)}% tanpa aksi jual panik.`
    };
  }

  // === 5. RISK EXPANSION (Low Vix + Positive Momentum) ===
  const expansionThreshold = DEFAULTS.VIX.expansion; // 14
  if (vix < expansionThreshold && nasdaqChange > 0.15) {
    return {
      intent: "Ekspansi Risiko 🚀",
      description: `Kondisi sangat optimis. VIX < ${expansionThreshold} — institusi meningkatkan leverage (Aggressive Risk-On).`
    };
  }

  return {
    intent: "Posisi Tunggu (Wait & See)",
    description: "Belum ada pola aliran institusional yang dominan. Smart Money menunggu katalis ekonomi besar."
  };
}

module.exports = { detectIntent };