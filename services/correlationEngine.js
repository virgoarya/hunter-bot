/**
 * correlationEngine.js
 * Mendeteksi anomali dan konfirmasi tren melalui korelasi antar aset (Cross-Asset Correlation).
 */

function detectCorrelationPatterns(state) {
    if (!state || !state.isHealthy) return null;

    const nasdaqChange = parseFloat(state.NASDAQ?.change) || 0;
    const goldChange = parseFloat(state.GOLD?.change) || 0;
    const dxyChange = parseFloat(state.DXY?.change) || 0;
    const yieldChange = parseFloat(state.US10Y?.change) || 0;
    const repoData = state.RepoData;
    const repoChange = repoData && !repoData.error ? parseFloat(repoData.changePercent) || 0 : 0;

    let signal = "NETRAL";
    let description = "Korelasi pasar dalam batas normal.";
    let strength = "Low";

    // 1. PANIK SESUNGGUHNYA (Gold Up + USD Up + Equity Down)
    // Skenario Flight-to-Safety total.
    if (goldChange > 0.2 && dxyChange > 0.1 && nasdaqChange < -0.5) {
        signal = "PANIK SESUNGGUHNYA 🚨";
        description = "Korelasi ekstrem: Emas dan USD naik bersamaan sementara saham jatuh. Institusi lari ke segala bentuk pengamanan.";
        strength = "High";
    }

    // 2. RISK-ON SEJATI (Gold Down + Equity Up + Repo Down)
    // Dana mengalir keluar dari safe-haven (Emas) dan kas (Repo) menuju aset berisiko.
    else if (goldChange < -0.2 && nasdaqChange > 0.3 && repoChange < -5) {
        signal = "RISK-ON SEJATI 🚀";
        description = "Korelasi positif pertumbuhan: Dana mengalir dari kas (Repo) dan emas ke pasar ekuitas.";
        strength = "High";
    }

    // 3. HEALTHY GROWTH (Yield Up + Equity Up)
    // Pertumbuhan ekonomi kuat menyerap kenaikan biaya modal.
    else if (yieldChange > 0.02 && nasdaqChange > 0.4) {
        signal = "HEALTHY GROWTH 🔋";
        description = "Korelasi pertumbuhan: Ekuitas naik meskipun imbal hasil (yield) naik, menunjukkan kekuatan fundamental.";
        strength = "Medium";
    }

    // 4. STRESS (Yield Up + Equity Down)
    // Kenaikan suku bunga/yield mulai menekan valuasi saham.
    else if (yieldChange > 0.02 && nasdaqChange < -0.4) {
        signal = "MARKET STRESS ⚠️";
        description = "Korelasi tekanan: Kenaikan imbal hasil obligasi mulai merusak selera risiko di ekuitas.";
        strength = "Medium";
    }

    // 5. DIVERGENSI EMAS (Yield Up + Gold Up)
    // Anomali: Emas naik meskipun yield naik (biasanya negatif). Sinyal inflasi atau ketegangan geopolitik.
    else if (yieldChange > 0.02 && goldChange > 0.3) {
        signal = "DIVERGENSI EMAS 🥇";
        description = "Anomali: Emas menguat mengabaikan kenaikan imbal hasil. Kemungkinan kekhawatiran inflasi atau geopolitik.";
        strength = "Medium";
    }

    return { signal, description, strength };
}

module.exports = { detectCorrelationPatterns };
