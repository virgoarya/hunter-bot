/**
 * tradingInsight.js
 * Menghasilkan insight posisi trading yang sederhana dan mudah dipahami
 * berdasarkan logika makro Hunter Bot (regime, bias, intent, ON RRP).
 * 
 * DISCLAIMER: Semua insight bersifat edukatif dan bukan saran transaksi.
 */

function buildTradingInsight(regime, bias, intent, repoData = null) {
    const regimeText = regime?.regime || "";
    const intentText = intent?.intent || "";

    // ON RRP signal
    let repoSignal = "NETRAL";
    if (repoData && !repoData.error) {
        const change = parseFloat(repoData.changePercent) || 0;
        if (change > 5) repoSignal = "RISK_OFF";
        else if (change < -5) repoSignal = "RISK_ON";
    }

    // === Determine overall market stance ===
    let marketStance = "NETRAL";
    let stanceEmoji = "⚖️";
    let stanceLabel = "WAIT & SEE";

    if (regimeText.includes("Kepanikan") || intentText.includes("De-risking")) {
        marketStance = "STRONG_BEARISH";
        stanceEmoji = "🔴";
        stanceLabel = "DEFENSIVE MODE";
    } else if (regimeText.includes("Stagflasi")) {
        marketStance = "BEARISH";
        stanceEmoji = "🟠";
        stanceLabel = "CAUTIOUS";
    } else if (regimeText.includes("Goncangan")) {
        marketStance = "BEARISH";
        stanceEmoji = "🟠";
        stanceLabel = "RISK-OFF";
    } else if (regimeText.includes("Reflasi") || intentText.includes("Ekspansi")) {
        marketStance = "STRONG_BULLISH";
        stanceEmoji = "🟢";
        stanceLabel = "RISK-ON";
    } else if (regimeText.includes("Goldilocks") || intentText.includes("Akumulasi")) {
        marketStance = "BULLISH";
        stanceEmoji = "🟢";
        stanceLabel = "ACCUMULATE";
    } else if (regimeText.includes("Defensif") || intentText.includes("Distribusi")) {
        marketStance = "CAUTIOUS";
        stanceEmoji = "🟡";
        stanceLabel = "REDUCE EXPOSURE";
    }

    // === Per-instrument insights ===
    const insights = [];

    // GOLD
    const goldBias = bias?.goldBias || "Netral";
    if (goldBias.includes("Strong Bullish")) {
        insights.push({ instrument: "🥇 GOLD (XAU/USD)", direction: "STRONG BUY / LONG 🚀", emoji: "🟢", reason: getGoldReason("strong_bullish", regimeText, repoSignal) });
    } else if (goldBias === "Bullish") {
        insights.push({ instrument: "🥇 GOLD (XAU/USD)", direction: "BUY / LONG", emoji: "🟢", reason: getGoldReason("bullish", regimeText, repoSignal) });
    } else if (goldBias.includes("Slight Bullish")) {
        insights.push({ instrument: "🥇 GOLD (XAU/USD)", direction: "ACCUMULATE / WATCH 📈", emoji: "🟡", reason: getGoldReason("slight_bullish", regimeText, repoSignal) });
    } else if (goldBias.includes("Strong Bearish")) {
        insights.push({ instrument: "🥇 GOLD (XAU/USD)", direction: "STRONG SELL / SHORT 📉", emoji: "🔴", reason: getGoldReason("strong_bearish", regimeText, repoSignal) });
    } else if (goldBias.includes("Bearish")) {
        insights.push({ instrument: "🥇 GOLD (XAU/USD)", direction: "SELL / SHORT", emoji: "🔴", reason: getGoldReason("bearish", regimeText, repoSignal) });
    } else if (goldBias.includes("Slight Bearish")) {
        insights.push({ instrument: "🥇 GOLD (XAU/USD)", direction: "REDUCE / WATCH 📉", emoji: "🟠", reason: getGoldReason("slight_bearish", regimeText, repoSignal) });
    } else {
        insights.push({ instrument: "🥇 GOLD (XAU/USD)", direction: "WAIT / NETRAL", emoji: "⚪", reason: "Belum ada arah yang jelas. Tunggu konfirmasi dari pergerakan real yield dan DXY." });
    }

    // FOREX (USD pairs)
    const usdBias = bias?.usdBias || "Netral";
    if (usdBias.includes("Strong Bullish")) {
        insights.push({ instrument: "💵 USD (DXY)", direction: "USD MENGUAT TAJAM 🚀", emoji: "🟢", reason: getUsdReason("strong_bullish", regimeText, repoSignal) });
    } else if (usdBias.includes("Bullish")) {
        insights.push({ instrument: "💵 USD (DXY)", direction: "USD MENGUAT", emoji: "🟢", reason: getUsdReason("bullish", regimeText, repoSignal) });
    } else if (usdBias.includes("Bearish")) {
        insights.push({ instrument: "💵 USD (DXY)", direction: "USD MELEMAH", emoji: "🔴", reason: getUsdReason("bearish", regimeText, repoSignal) });
    } else {
        insights.push({ instrument: "💵 USD (DXY)", direction: "NETRAL", emoji: "⚪", reason: "USD dalam konsolidasi. Pantau data ekonomi AS untuk konfirmasi arah." });
    }

    // EQUITY (NASDAQ / Saham)
    const eqBias = bias?.equityBias || "Netral";
    if (eqBias.includes("Strong Bullish")) {
        insights.push({ instrument: "📈 SAHAM (NASDAQ)", direction: "STRONG BUY / LONG 🚀", emoji: "🟢", reason: getEquityReason("strong_bullish", regimeText, repoSignal) });
    } else if (eqBias === "Bullish") {
        insights.push({ instrument: "📈 SAHAM (NASDAQ)", direction: "BUY / LONG", emoji: "🟢", reason: getEquityReason("bullish", regimeText, repoSignal) });
    } else if (eqBias.includes("Slight Bullish")) {
        insights.push({ instrument: "📈 SAHAM (NASDAQ)", direction: "WAIT / ACCUMULATE 📈", emoji: "🟡", reason: getEquityReason("slight_bullish", regimeText, repoSignal) });
    } else if (eqBias.includes("Strong Bearish")) {
        insights.push({ instrument: "📈 SAHAM (NASDAQ)", direction: "STRONG SELL / SHORT 📉", emoji: "🔴", reason: getEquityReason("strong_bearish", regimeText, repoSignal) });
    } else if (eqBias.includes("Bearish")) {
        insights.push({ instrument: "📈 SAHAM (NASDAQ)", direction: "SELL / SHORT", emoji: "🔴", reason: getEquityReason("bearish", regimeText, repoSignal) });
    } else {
        insights.push({ instrument: "📈 SAHAM (NASDAQ)", direction: "WAIT / NETRAL", emoji: "⚪", reason: "Pasar belum menunjukkan arah yang dominan. Hindari posisi besar." });
    }

    // === Format the complete insight text ===
    let insightText = `${stanceEmoji} **POSISI PASAR: ${stanceLabel}**\n\n`;

    for (const item of insights) {
        insightText += `${item.emoji} **${item.instrument}**: ${item.direction}\n`;
        insightText += `   _${item.reason}_\n\n`;
    }

    // === Practical Tips ===
    insightText += getPracticalTips(marketStance, repoSignal);

    insightText += `\n\n_⚠️ Insight ini berdasarkan data makro real-time dan bersifat edukatif, bukan saran transaksi._`;

    return {
        text: insightText,
        stance: stanceLabel,
        stanceEmoji,
        marketStance,
        insights
    };
}

// === Helper: Gold reasoning ===
function getGoldReason(direction, regime, repoSignal) {
    if (direction === "bullish") {
        if (regime.includes("Stagflasi")) return "Inflasi panas mendorong permintaan safe-haven. Emas cenderung naik saat real yield tertekan.";
        if (regime.includes("Goncangan")) return "Ketakutan resesi membuat investor beralih ke emas sebagai perlindungan nilai.";
        if (repoSignal === "RISK_OFF") return "Institusi memarkir dana di The Fed — sinyal ketidakpastian tinggi, mendukung emas.";
        return "Kondisi makro mendukung kenaikan emas. Real yield rendah mengurangi biaya peluang memegang emas.";
    }
    if (regime.includes("Reflasi")) return "Pertumbuhan ekonomi kuat membuat investor memilih aset berisiko dibanding emas.";
    if (repoSignal === "RISK_ON") return "Likuiditas mengalir ke pasar (ON RRP turun) — emas kurang diminati saat risk-on.";
    return "Real yield tinggi meningkatkan biaya peluang memegang emas. USD kuat menekan harga emas.";
}

// === Helper: USD reasoning ===
function getUsdReason(direction, regime, repoSignal) {
    if (direction === "bullish") {
        if (regime.includes("Kepanikan")) return "Mode safe-haven aktif. USD menguat sebagai mata uang cadangan dunia.";
        if (regime.includes("Stagflasi")) return "Yield AS tinggi menarik arus modal global (Carry Trade). EUR/USD dan GBP/USD cenderung turun.";
        return "Fundamental AS mendukung penguatan dolar. Pertimbangkan sell pada EUR/USD, GBP/USD.";
    }
    if (repoSignal === "RISK_ON") return "Likuiditas mengalir kembali ke pasar — tekanan pada dolar. EUR/USD dan GBP/USD berpotensi naik.";
    return "Real yield menurun dan pertumbuhan global membaik — membebani dolar. EUR/USD dan GBP/USD berpotensi naik.";
}

// === Helper: Equity reasoning ===
function getEquityReason(direction, regime, repoSignal) {
    if (direction === "bullish") {
        if (regime.includes("Reflasi")) return "Pertumbuhan kuat + kondisi finansial longgar. Saham teknologi berpotensi outperform.";
        if (regime.includes("Goldilocks")) return "VIX rendah + likuiditas melimpah. Kondisi ideal untuk akumulasi ekuitas.";
        if (repoSignal === "RISK_ON") return "ON RRP menurun — likuiditas baru masuk ke pasar, memberikan angin segar bagi saham.";
        return "Sentimen risk-on mendominasi. Saham berpotensi melanjutkan reli.";
    }
    if (regime.includes("Kepanikan")) return "Volatilitas ekstrem! Hindari posisi long agresif. Prioritaskan manajemen risiko.";
    if (regime.includes("Stagflasi")) return "Inflasi merusak valuasi + yield naik. Tekanan ganda pada saham pertumbuhan.";
    if (repoSignal === "RISK_OFF") return "Institusi parkir uang di The Fed (ON RRP naik) — kurang minat beli saham.";
    return "Kondisi makro tidak mendukung ekuitas. Kurangi eksposur dan pertimbangkan hedging.";
}

// === Helper: Practical Tips ===
function getPracticalTips(stance, repoSignal) {
    let tips = "💡 **Tips Praktis:**\n";

    switch (stance) {
        case "STRONG_BEARISH":
            tips += "• Hindari posisi long agresif. Prioritaskan proteksi modal.\n";
            tips += "• Kurangi ukuran posisi (position size) menjadi 50% dari normal.\n";
            tips += "• Perhatikan level support kunci — break bisa memicu penurunan tajam.";
            break;
        case "BEARISH":
        case "CAUTIOUS":
            tips += "• Berhati-hati membuka posisi baru. Pasar dalam tekanan.\n";
            tips += "• Jika sudah punya posisi, perketat stop-loss.\n";
            tips += "• Pantau VIX dan yield AS untuk sinyal pemulihan.";
            break;
        case "STRONG_BULLISH":
            tips += "• Momentum kuat mendukung posisi searah tren (trend-following).\n";
            tips += "• Manfaatkan pullback/retracement untuk entry.\n";
            tips += "• Jangan melawan arus — hindari counter-trend trading.";
            break;
        case "BULLISH":
            tips += "• Kondisi mendukung akumulasi bertahap (DCA).\n";
            tips += "• Pilih instrumen dengan momentum terkuat.\n";
            tips += "• Tetap pasang stop-loss di level invalidation.";
            break;
        default:
            tips += "• Pasar belum punya arah jelas — kurangi frekuensi trading.\n";
            tips += "• Tunggu konfirmasi dari data ekonomi atau pergerakan harga.\n";
            tips += "• Jaga ukuran posisi tetap kecil hingga ada kejelasan.";
    }

    if (repoSignal === "RISK_OFF") {
        tips += "\n• 🏦 ON RRP naik — institusi \"parkir\" uang. Likuiditas pasar menipis.";
    } else if (repoSignal === "RISK_ON") {
        tips += "\n• 🏦 ON RRP turun — likuiditas segar masuk ke pasar. Potensi rally.";
    }

    return tips;
}

module.exports = { buildTradingInsight };
