function buildSessionBias(regime, bias, intent) {
  if (!bias || !regime || !intent) {
    return {
      londonBias: "Data sesi tidak mencukupi.",
      newyorkBias: "Data sesi tidak mencukupi."
    };
  }

  const regimeText = regime.regime || "";
  const intentText = intent.intent || "";

  let london = "";
  let newyork = "";

  // ===== LONDON FLOW =====
  if (intentText === "Perlindungan Panik") {
    london = "Aliran defensif kemungkinan besar akan mendominasi awal sesi London karena volatilitas tetap tinggi.";
  }
  else if (regimeText.includes("Risk-Off")) {
    london = "Kekhawatiran akan pertumbuhan dapat memicu aliran safe-haven selama pembukaan pasar Eropa.";
  }
  else if (regimeText.includes("Tekanan")) {
    london = "Tekanan imbal hasil (yield) kemungkinan besar akan mempertahankan posisi defensif.";
  }
  else if (regimeText.includes("Pertumbuhan")) {
    london = "Latar belakang likuiditas positif mendukung selera risiko awal.";
  }
  else {
    london = "Posisi seimbang memasuki sesi London.";
  }

  // ===== NEW YORK FLOW =====
  if (intentText === "Perlindungan Panik") {
    newyork = "Risiko likuidasi tetap tinggi memasuki sesi NY seiring meningkatnya volatilitas.";
  }
  else if (regimeText.includes("Risk-Off")) {
    newyork = "Aliran pelarian ke aset aman (flight-to-safety) kemungkinan akan berlanjut melalui meja perdagangan NY.";
  }
  else if (regimeText.includes("Tekanan")) {
    newyork = "Tekanan pendanaan dapat membuat aset berisiko tetap tertekan hingga penutupan NY.";
  }
  else if (regimeText.includes("Pertumbuhan")) {
    newyork = "Selera risiko kemungkinan akan meluas ke sesi New York.";
  }
  else {
    newyork = "Menunggu katalis arah dari data Amerika Utara.";
  }

  return {
    londonBias: london,
    newyorkBias: newyork
  };
}

module.exports = { buildSessionBias };
