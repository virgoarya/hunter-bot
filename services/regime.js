function classifyRegime(state) {
  if (!state?.DXY || !state?.US10Y || !state?.NASDAQ || !state?.GOLD || !state?.VIX) {
    return {
      regime: "Data Tidak Lengkap",
      description: "Macro state belum siap untuk analisis institusional."
    };
  }

  const dxy = state.DXY.close;
  const us10y = state.US10Y.close;
  const realYield = state.RealYield?.close || (us10y - 2.0);
  const vix = state.VIX.close;

  // Deteksi Perubahan (Jika provider menyediakan 'change', gunakan itu. Jika tidak, asumsikan netral untuk kestabilan)
  const nasdaqChange = parseFloat(state.NASDAQ.change) || 0;
  const yieldChange = parseFloat(state.US10Y.change) || 0;
  const goldChange = parseFloat(state.GOLD.change) || 0;

  // === 1. SYSTEMIC PANIC (VIX Driven) ===
  // Prioritas utama: Ketika volatilitas meledak, korelasi antar aset biasanya menjadi 1 (semua dijual).
  if (vix > 28) {
    return {
      regime: "Kepanikan Sistemik 🚨",
      description: "Ekspansi volatilitas ekstrem. Likuidasi paksa di semua kelas aset. Cash (USD) adalah raja."
    };
  }

  // === 2. STAGFLATIONARY STRESS (Yields Up + Equities Down + Gold Strong) ===
  // Inflasi panas yang mulai merusak pertumbuhan (Bad for Equities, Good for Gold/USD)
  if (us10y > 4.2 && nasdaqChange < -0.5 && goldChange > 0) {
    return {
      regime: "Stagflasi ⚠️",
      description: "Tekanan inflasi merusak valuasi ekuitas. Imbal hasil naik tajam sementara Emas dicari sebagai pelindung nilai."
    };
  }

  // === 3. DEFLATIONARY SHOCK / GROWTH FEAR (Yields Down + Equities Down) ===
  // Ketakutan akan resesi atau perlambatan ekonomi (Bonds Up/Yields Down, Equities Down)
  if (us10y < 3.8 && nasdaqChange < -0.8) {
    return {
      regime: "Goncangan Deflasi 📉",
      description: "Kekhawatiran resesi mendominasi. Investor lari dari risiko ke obligasi pemerintah (Safe Haven)."
    };
  }

  // === 4. REFLATION / HEALTHY GROWTH (Yields Up + Equities Up) ===
  // Pertumbuhan ekonomi yang kuat memicu kenaikan yields dan laba perusahaan secara bersamaan.
  if (us10y > 4.0 && nasdaqChange > 0.3 && vix < 20) {
    return {
      regime: "Reflasi 🚀",
      description: "Pertumbuhan ekonomi yang optimis. Institusi melakukan akumulasi pada aset berisiko (Risk-On)."
    };
  }

  // === 5. GOLDILOCKS (Low Vol + Stable Yields + Equities Up) ===
  // Skenario terbaik: Pertumbuhan tanpa inflasi berlebih.
  if (vix < 16 && us10y > 3.5 && us10y < 4.2 && nasdaqChange >= 0) {
    return {
      regime: "Goldilocks ✨",
      description: "Kondisi ideal. Pertumbuhan stabil dengan volatilitas rendah. Likuiditas melimpah."
    };
  }

  // === 6. DEFENSIVE / LIQUIDITY TIGHTENING ===
  if (dxy > 102 || vix > 19) {
    return {
      regime: "Defensif 🛡️",
      description: "Pengetatan likuiditas global. Institusi mengurangi eksposur dan meningkatkan kepemilikan uang tunai."
    };
  }

  return {
    regime: "Transisi Makro",
    description: "Korelasi antar-pasar sedang mencari keseimbangan baru. Belum ada tren dominan."
  };
}

module.exports = { classifyRegime };