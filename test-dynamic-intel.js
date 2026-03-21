require("dotenv").config();
const { updateMacroData, getMacroState } = require("./services/macroData");
const { classifyRegime } = require("./services/regime");
const { buildBias } = require("./services/biasEngine");
const { detectIntent } = require("./services/intentEngine");
const { detectCorrelationPatterns } = require("./services/correlationEngine");
const { analyzeRateOfChange } = require("./services/rateOfChange");
const { saveSnapshot } = require("./services/macroHistory");

async function testDynamicIntel() {
    console.log("=== TESTING DYNAMIC INTELLIGENCE ===\n");

    // 1. Update data
    await updateMacroData();
    const state = getMacroState();
    
    if (!state.isHealthy) {
        console.error("Data unhealthy!");
        return;
    }

    // 2. Save snapshot (to build 1st data point)
    saveSnapshot(state);

    // 3. Run Engines
    const regime = classifyRegime(state);
    const bias = buildBias(state, regime);
    const intent = detectIntent(state);
    const correlation = detectCorrelationPatterns(state);
    const rocShocks = analyzeRateOfChange(state);

    console.log("--- RESULTS ---");
    console.log("Regime (Adaptive):", regime.regime);
    console.log("Regime Desc:", regime.description);
    console.log("\nBias (Adaptive):", JSON.stringify(bias, null, 2));
    
    console.log("\nCorrelation Signal:", correlation.signal);
    console.log("Correlation Desc:", correlation.description);
    
    console.log("\nROC Shocks Detected:");
    const shocks = Object.entries(rocShocks)
        .filter(([_, d]) => d.hasShock)
        .map(([s, d]) => `${s}: ${d.shockType}`);
    console.log(shocks.length > 0 ? shocks.join("\n") : "None (Market is calm)");

    console.log("\n=== TEST COMPLETE ===");
}

testDynamicIntel().catch(console.error);
