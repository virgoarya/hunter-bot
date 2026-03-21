function buildSessionBias(regime, bias, intent, repoData = null) {
  if (!bias || !regime || !intent) {
    return {
      asiaBias: "Data sesi tidak mencukupi.",
      londonBias: "Data sesi tidak mencukupi.",
      newyorkBias: "Data sesi tidak mencukupi."
    };
  }

  const regimeText = regime.regime || "";
  const intentText = intent.intent || "";

  // ON RRP context string
  let repoContext = "";
  if (repoData && !repoData.error) {
    const change = parseFloat(repoData.changePercent) || 0;
    if (change > 5) {
      repoContext = " Likuiditas O/N RRP meningkat — institusi memarkir lebih banyak dana di The Fed (tekanan jual potensial).";
    } else if (change < -5) {
      repoContext = " Likuiditas O/N RRP menurun — dana institusi mengalir kembali ke pasar (potensi risk-on).";
    }
  }

  let asia = "";
  let london = "";
  let newyork = "";

  // ===== ASIA SESSION =====
  if (regimeText.includes("Kepanikan")) {
    asia = "Sesi Asia berpotensi membuka dengan gap negatif. Volatilitas tinggi dari penutupan NY sebelumnya masih terasa.";
  } else if (regimeText.includes("Stagflasi")) {
    asia = "Konsolidasi tipis di sesi Asia. Tekanan inflasi masih membayang sementara pasar menunggu respons London.";
  } else if (regimeText.includes("Goncangan")) {
    asia = "Sentimen risk-off dari kekhawatiran resesi bisa menekan pembukaan Asia. Safe-haven (JPY, Gold) berpotensi menguat.";
  } else if (regimeText.includes("Reflasi")) {
    asia = "Momentum positif dari sesi NY semalam berpeluang membawa sentimen risk-on ke pembukaan Asia.";
  } else if (regimeText.includes("Goldilocks")) {
    asia = "Kondisi likuiditas ideal. Sesi Asia berpotensi stabil dan mendukung akumulasi gradual.";
  } else if (regimeText.includes("Defensif")) {
    asia = "Pengetatan likuiditas global membuat sesi Asia cenderung hati-hati. Volume tipis, waspadai false breakout.";
  } else {
    asia = "Sesi Asia dalam fase transisi. Pergerakan terbatas sambil menunggu arah dari London.";
  }

  // ===== LONDON SESSION =====
  if (regimeText.includes("Kepanikan")) {
    london = "Aliran defensif akan mendominasi pembukaan London. Volatilitas tinggi, likuidasi potensial berlanjut.";
  } else if (regimeText.includes("Stagflasi")) {
    london = "Tekanan imbal hasil tinggi menekan ekuitas Eropa. Emas bisa menjadi tujuan rotasi. USD berpotensi menguat.";
  } else if (regimeText.includes("Goncangan")) {
    london = "Kekhawatiran resesi bisa memicu aliran safe-haven (Bund, Gilts) di pembukaan Eropa. Ekuitas tertekan.";
  } else if (regimeText.includes("Reflasi")) {
    london = "Latar belakang likuiditas positif mendukung selera risiko. Ekuitas Eropa berpotensi melanjutkan reli.";
  } else if (regimeText.includes("Goldilocks")) {
    london = "Kondisi ideal. London berpotensi melanjutkan tren positif dari Asia dengan volume yang meningkat.";
  } else if (regimeText.includes("Defensif")) {
    london = "Pengetatan likuiditas membuat London cenderung defensif. Perhatikan reaksi terhadap data Eropa.";
  } else {
    london = "Posisi seimbang memasuki sesi London. Menunggu katalis dari data ekonomi Eropa.";
  }

  // ===== NEW YORK SESSION =====
  if (regimeText.includes("Kepanikan")) {
    newyork = "Risiko likuidasi tetap tinggi memasuki sesi NY. Korelasi antar-aset menjadi satu (semua dijual).";
  } else if (regimeText.includes("Stagflasi")) {
    newyork = "Tekanan pendanaan membuat ekuitas AS tetap tertekan. Perhatikan reaksi pasar terhadap data inflasi AS.";
  } else if (regimeText.includes("Goncangan")) {
    newyork = "Flight-to-safety ke Treasury AS. Imbal hasil turun, USD menguat secara selektif.";
  } else if (regimeText.includes("Reflasi")) {
    newyork = "Selera risiko meluas ke sesi NY. Tech & growth stocks berpotensi outperform.";
  } else if (regimeText.includes("Goldilocks")) {
    newyork = "Kondisi optimal. NY berpotensi membawa momentum positif ke penutupan. VIX rendah mendukung carry trade.";
  } else if (regimeText.includes("Defensif")) {
    newyork = "Tekanan pendanaan bisa membuat aset berisiko tetap tertekan hingga penutupan NY. Perhatikan auction Treasury.";
  } else {
    newyork = "Menunggu katalis arah dari data ekonomi Amerika. Pasar dalam posisi wait-and-see.";
  }

  // Overlay intent context
  if (intentText.includes("De-risking")) {
    london += " ⚠️ De-risking institusional terdeteksi — waspadai tekanan jual lanjutan.";
    newyork += " ⚠️ De-risking masih aktif — volatilitas tinggi.";
  } else if (intentText.includes("Akumulasi")) {
    london += " 🏦 Smart Money mulai masuk — potensi dukungan intraday.";
    newyork += " 🏦 Akumulasi berlanjut — potensi pemulihan gradual.";
  } else if (intentText.includes("Distribusi")) {
    london += " 📉 Distribusi diam-diam terdeteksi — hati-hati bear trap.";
    newyork += " 📉 Distribusi masih berlangsung — jangan terjebak reli semu.";
  }

  // Append repo context
  if (repoContext) {
    asia += repoContext;
    london += repoContext;
    newyork += repoContext;
  }

  return {
    asiaBias: asia,
    londonBias: london,
    newyorkBias: newyork
  };
}

module.exports = { buildSessionBias };
