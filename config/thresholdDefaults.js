/**
 * thresholdDefaults.js
 * Single Source of Truth untuk semua default threshold Institutional Desk.
 * 
 * Digunakan oleh: regime.js, biasEngine.js, intentEngine.js
 * 
 * Pendekatan Bertingkat (Tiered):
 *   VIX > elevated  → Bias mulai bearish / cautious
 *   VIX > high      → Regime stress / defensif
 *   VIX > veryHigh  → Regime panik sistemik
 */

const DEFAULTS = {
    VIX: {
        low: 16,        // Goldilocks zone
        elevated: 22,   // Elevated — bias mulai bergeser bearish
        high: 28,       // Stress — regime defensif / panik
        veryHigh: 35,   // Krisis sistemik
        mean: 20,
        // Intent thresholds
        accumulation: 20,   // VIX < ini + harga stabil = akumulasi
        distribution: 16,   // VIX < ini + harga turun = distribusi diam-diam
        expansion: 14,      // VIX < ini + momentum positif = ekspansi risiko
        derisking: 24       // VIX > ini = de-risking sistemik
    },
    US10Y: {
        high: 4.2,
        low: 3.8,
        mean: 4.0,
        // Intent threshold
        yieldAbsorption: 4.1  // Yield > ini tapi ekuitas masih kuat
    },
    DXY: {
        high: 100.2,
        low: 98.8,
        mean: 99.5
    },
    RealYield: {
        high: 1.9,
        low: 1.4,
        mean: 1.65
    },
    // Shock detection thresholds (rateOfChange)
    Shocks: {
        VIX_SURGE: 15,          // VIX roc24h > 15%
        YIELD_STRESS: 0.15,     // US10Y absolute change > 0.15
        EQUITY_LIQUIDATION: -2.0, // NASDAQ roc24h < -2%
        OIL_SPIKE: 4.0          // OIL roc24h > 4%
    }
};

module.exports = { DEFAULTS };
