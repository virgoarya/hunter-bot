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

  // === 1. SYSTEMIC DE-RISKING (High Vol + Price Drop) ===
  if (vix > 24 || (vixChange > 12 && nasdaqChange < -0.8)) {
    return {
      intent: "De-risking Sistemik 🚨",
      description: "Institusi secara agresif mengurangi eksposur. Korelasi negatif yang tajam antara harga saham dan volatilitas."
    };
  }

  // === 2. INSTITUTIONAL ACCUMULATION (Vix Down + Price Steady/Up) ===
  // "Quiet Buying" - Smart Money masuk kembali saat volatilitas mendingin.
  if (vixChange < -4 && nasdaqChange >= -0.2 && vix < 20) {
    return {
      intent: "Akumulasi Institusional 🏦",
      description: "Smart Money mulai masuk kembali. Volatilitas menurun saat harga mulai membangun basis dukungan."
    };
  }

  // === 3. INSTITUTIONAL DISTRIBUTION (Price Weak + Vix still Low) ===
  // "Quiet Selling" - Institusi menjual ke ritel sebelum lonjakan volatilitas.
  if (nasdaqChange < -0.4 && vix < 16) {
    return {
      intent: "Distribusi Institusional 📉",
      description: "Penjualan diam-diam (exit) oleh institusi. Harga melemah meskipun VIX belum menunjukkan kepanikan."
    };
  }

  // === 4. YIELD ABSORPTION (Yields Up + Equities Resilience) ===
  // Pasar tetap kuat meskipun biaya modal naik.
  if (yield10y > 4.1 && nasdaqChange > -0.25) {
    return {
      intent: "Penyerapan Imbal Hasil 🔋",
      description: "Ekuitas menunjukkan kekuatan dengan menyerap kenaikan imbal hasil obligasi tanpa aksi jual panik."
    };
  }

  // === 5. RISK EXPANSION (Low Vix + Positive Momentum) ===
  if (vix < 14 && nasdaqChange > 0.15) {
    return {
      intent: "Ekspansi Risiko 🚀",
      description: "Kondisi sangat optimis. Institusi meningkatkan leverage untuk aset berisiko (Aggressive Risk-On)."
    };
  }

  return {
    intent: "Posisi Tunggu (Wait & See)",
    description: "Belum ada pola aliran institusional yang dominan. Smart Money menunggu katalis ekonomi besar."
  };
}

module.exports = { detectIntent };