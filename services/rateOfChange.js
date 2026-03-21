/**
 * rateOfChange.js
 * Menghitung kecepatan perubahan (momentum) instrumen makro.
 * Mendeteksi lonjakan (shocks) yang mendadak.
 */

const { getSnapshotHoursAgo } = require("./macroHistory");

/**
 * Menghitung persentase perubahan antara sekarang dan N jam yang lalu.
 */
function calculateRoC(currentValue, valueN, isPercentage = false) {
    if (currentValue === null || valueN === null || valueN === 0) return 0;
    
    if (isPercentage) {
        // Untuk Yield yang sudah dalam bentuk persen
        return currentValue - valueN;
    }

    return ((currentValue - valueN) / Math.abs(valueN)) * 100;
}

/**
 * Menganalisis kecepatan perubahan instrumen makro.
 */
function analyzeRateOfChange(state) {
    if (!state || !state.isHealthy) return null;

    const snap24h = getSnapshotHoursAgo(24);
    const snap7d = getSnapshotHoursAgo(168); // 7 hari

    const results = {};

    const instruments = [
        { key: "VIX", isPct: false },
        { key: "US10Y", isPct: true },
        { key: "DXY", isPct: false },
        { key: "NASDAQ", isPct: false },
        { key: "GOLD", isPct: false }
    ];

    for (const inst of instruments) {
        const current = state[inst.key]?.close;
        
        results[inst.key] = {
            roc24h: snap24h ? calculateRoC(current, snap24h[inst.key], inst.isPct) : 0,
            roc7d: snap7d ? calculateRoC(current, snap7d[inst.key], inst.isPct) : 0,
            hasShock: false,
            shockType: null
        };

        // Deteksi Shock (Kecepatan ekstrem)
        if (inst.key === "VIX" && results[inst.key].roc24h > 15) {
            results[inst.key].hasShock = true;
            results[inst.key].shockType = "VOLATILITY_SURGE ⚡";
        }
        
        if (inst.key === "US10Y" && Math.abs(results[inst.key].roc24h) > 0.15) {
            results[inst.key].hasShock = true;
            results[inst.key].shockType = "YIELD_STRESS 🌋";
        }

        if (inst.key === "NASDAQ" && results[inst.key].roc24h < -2.0) {
            results[inst.key].hasShock = true;
            results[inst.key].shockType = "EQUITY_LIQUIDATION 🩸";
        }
    }

    return results;
}

module.exports = { analyzeRateOfChange };
