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

    if (goldChange > 0.2 && dxyChange > 0.1 && nasdaqChange < -0.5) {
        signal = "PANIK SESUNGGUHNYA 🚨";
        description = "Korelasi ekstrem: Emas dan USD naik bersamaan sementara saham jatuh. Institusi lari ke segala bentuk pengamanan.";
        strength = "High";
    } else if (goldChange < -0.2 && nasdaqChange > 0.3 && repoChange < -5) {
        signal = "RISK-ON SEJATI 🚀";
        description = "Korelasi positif pertumbuhan: Dana mengalir dari kas (Repo) dan emas ke pasar ekuitas.";
        strength = "High";
    } else if (yieldChange > 0.02 && nasdaqChange > 0.4) {
        signal = "HEALTHY GROWTH 🔋";
        description = "Korelasi pertumbuhan: Ekuitas naik meskipun imbal hasil (yield) naik, menunjukkan kekuatan fundamental.";
        strength = "Medium";
    } else if (yieldChange > 0.02 && nasdaqChange < -0.4) {
        signal = "MARKET STRESS ⚠️";
        description = "Korelasi tekanan: Kenaikan imbal hasil obligasi mulai merusak selera risiko di ekuitas.";
        strength = "Medium";
    } else if (yieldChange > 0.02 && goldChange > 0.3) {
        signal = "DIVERGENSI EMAS 🥇";
        description = "Anomali: Emas menguat mengabaikan kenaikan imbal hasil. Kemungkinan kekhawatiran inflasi atau geopolitik.";
        strength = "Medium";
    }

    return { signal, description, strength };
}

function detectDivergences(state) {
    if (!state || !state.isHealthy) return [];
    
    const divergences = [];
    const dxyChange = parseFloat(state.DXY?.change) || 0;
    const goldChange = parseFloat(state.GOLD?.change) || 0;
    const vixChange = parseFloat(state.VIX?.change) || 0;
    const repoData = state.RepoData;
    const repoChange = repoData && !repoData.error ? parseFloat(repoData.changePercent) || 0 : 0;
    const nasdaqChange = parseFloat(state.NASDAQ?.change) || 0;

    // 1. VIX vs Gold Divergence (Complacency vs Tail Risk Hedging)
    if (vixChange < -2 && goldChange > 0.5) {
        divergences.push("⚠️ DIVERGENSI RISIKO: VIX turun (pasar saham santai) namun Emas melonjak tajam. Indikasi Smart Money sedang melakukan hedging (lindung nilai) terhadap risiko ekor tersembunyi (tail-risk).");
    }

    // 2. Liquidity Divergence
    if (repoChange < -2 && nasdaqChange < -0.5) {
        divergences.push("⚠️ DIVERGENSI LIKUIDITAS: ON RRP turun (likuiditas disuntikkan ke sistem) namun Nasdaq justru melemah. Indikasi likuiditas digunakan untuk exit liquidity (distribusi institusional) atau lari ke aset defensif.");
    }
    
    // 3. DXY vs Yield Divergence
    const yieldChange = parseFloat(state.US10Y?.change) || 0;
    if (yieldChange > 0.05 && dxyChange < -0.2) {
        divergences.push("⚠️ DIVERGENSI YIELD-FX: Yield US10Y naik tajam namun DXY justru melemah. Pasar mungkin mulai meragukan keberlanjutan fiskal AS atau arus modal justru keluar dari US aset.");
    }

    return divergences;
}

module.exports = { detectCorrelationPatterns, detectDivergences };
