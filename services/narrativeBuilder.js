function buildNarrative(regime = {}, bias = {}, intent = {}, shift = null) {
  const seasonality = bias.seasonality || {};

  const regimeText = regime?.regime || "";
  const intentText = intent?.intent || "";
  const shiftTo = shift?.to || "";

  // === REGIME SHIFT STORY ===
  if (shiftTo) {

    if (shiftTo.includes("Kepanikan")) {
      return "Pasar bertransisi ke rezim tekanan — institusi kemungkinan mempercepat perlindungan.";
    }

    if (shiftTo.includes("Likuiditas")) {
      return "Kondisi likuiditas memburuk — permintaan lindung nilai mungkin meningkat.";
    }

    if (shiftTo.includes("Pertumbuhan")) {
      return "Tekanan pendanaan mulai mereda — selera risiko mungkin muncul kembali.";
    }

    if (shiftTo.includes("Defensif")) {
      return "Pasar beralih ke posisi defensif seiring institusi mengurangi eksposur.";
    }
  }

  // === INTENT STORY ===
  if (intentText === "Perlindungan Panik") {
    return "Institusi segera mengurangi eksposur seiring melonjaknya volatilitas.";
  }

  if (intentText === "Lindung Nilai Aktif") {
    return "Dana meningkatkan perlindungan sisi bawah (downside protection) seiring pengetatan kondisi pendanaan.";
  }

  if (intentText === "Penyerapan Likuiditas") {
    return "Pasar menyerap tekanan makro tanpa keluarnya risiko secara luas.";
  }

  if (intentText === "Ekspansi Risiko") {
    return "Modal berputar ke aset pertumbuhan seiring membaiknya kondisi likuiditas.";
  }

  let baseNarrative = "Posisi pasar tetap seimbang tanpa niat institusional yang dominan.";
  if (regimeText.includes("Defensif")) {
    baseNarrative = "Institusi mempertahankan perlindungan sambil memonitor kondisi likuiditas.";
  }

  // === SEASONAL CONTEXT ===
  if (seasonality.note) {
    return `${baseNarrative} Secara historis, bulan ini dipengaruhi oleh: ${seasonality.note}.`;
  }

  return baseNarrative;
}

module.exports = { buildNarrative };