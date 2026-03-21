require("dotenv").config();
const { updateMacroData, getMacroState } = require("./services/macroData");
const { classifyRegime } = require("./services/regime");
const { buildBias } = require("./services/biasEngine");
const { detectIntent } = require("./services/intentEngine");
const { buildSessionBias } = require("./services/sessionBias");

async function testMacroPipeline() {
    console.log("=== TESTING FULL MACRO PIPELINE ===\n");

    console.log("1. Updating macro data (including ON RRP)...");
    await updateMacroData();
    const state = getMacroState();
    console.log("   ✅ Macro state healthy:", state.isHealthy);
    console.log("   RepoData:", state.RepoData ? `$${state.RepoData.amountBillion}B (${state.RepoData.changePercent}%)` : "N/A");

    console.log("\n2. Classifying regime...");
    const regime = classifyRegime(state);
    console.log("   Regime:", regime.regime);
    console.log("   Desc:", regime.description);

    console.log("\n3. Building bias...");
    const bias = buildBias(state, regime);
    console.log("   USD:", bias.usdBias, "| Gold:", bias.goldBias, "| Equity:", bias.equityBias);

    console.log("\n4. Detecting intent...");
    const intent = detectIntent(state);
    console.log("   Intent:", intent.intent);

    console.log("\n5. Building session bias (with repo data)...");
    const session = buildSessionBias(regime, bias, intent, state.RepoData);
    console.log("   Asia:", session.asiaBias);
    console.log("   London:", session.londonBias);
    console.log("   NY:", session.newyorkBias);

    console.log("\n=== ALL TESTS PASSED ===");
}

testMacroPipeline().catch(console.error);
