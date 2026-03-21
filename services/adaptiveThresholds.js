/**
 * adaptiveThresholds.js
 * Menghitung ambang batas (thresholds) dinamis berdasarkan riwayat pasar.
 * Menggunakan Simple Moving Average (SMA) dan Standar Deviasi (σ).
 */

const { getRecentValues } = require("./macroHistory");

/**
 * Menghitung SMA-20 dan Standar Deviasi.
 * @param {number[]} values - Array nilai historis.
 * @returns {object} - { mean, stdDev }
 */
function calculateStats(values) {
    if (!values || values.length < 5) return null; // Butuh minimal 5 data points

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;

    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(avgSquareDiff);

    return { mean, stdDev };
}

/**
 * Mendapatkan threshold adaptif untuk simbol tertentu.
 * @param {string} symbol - E.g., "VIX", "US10Y", "DXY"
 * @param {object} defaults - Nilai default jika riwayat tidak cukup.
 * @returns {object} - Thresholds dinamis.
 */
function getAdaptiveThresholds(symbol, defaults) {
    const values = getRecentValues(symbol, 20); // 20 data points terakhir
    const stats = calculateStats(values);

    if (!stats) return defaults;

    // Logika adaptif per instrumen
    if (symbol === "VIX") {
        return {
            high: stats.mean + (1.5 * stats.stdDev), // Panik = Mean + 1.5 StdDev
            veryHigh: stats.mean + (2.5 * stats.stdDev), // Krisis = Mean + 2.5 StdDev
            low: stats.mean - (1.0 * stats.stdDev), // Goldilocks = Mean - 1 StdDev
            mean: stats.mean
        };
    }

    if (symbol === "US10Y") {
        return {
            high: stats.mean + (1.0 * stats.stdDev),
            low: stats.mean - (1.0 * stats.stdDev),
            mean: stats.mean
        };
    }

    if (symbol === "DXY") {
        return {
            high: stats.mean + (1.0 * stats.stdDev),
            low: stats.mean - (1.0 * stats.stdDev),
            mean: stats.mean
        };
    }
    
    if (symbol === "RealYield") {
        return {
            high: stats.mean + (1.0 * stats.stdDev),
            low: stats.mean - (1.0 * stats.stdDev),
            mean: stats.mean
        };
    }

    return defaults;
}

module.exports = { getAdaptiveThresholds, calculateStats };
