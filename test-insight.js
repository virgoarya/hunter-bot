require("dotenv").config();
const { updateMacroData, getMacroState } = require("./services/macroData");
const { classifyRegime } = require("./services/regime");
const { buildBias } = require("./services/biasEngine");
const { detectIntent } = require("./services/intentEngine");
const { buildTradingInsight } = require("./services/tradingInsight");

async function testInsight() {
    console.log("=== TESTING TRADING INSIGHT ===\n");

    await updateMacroData();
    const state = getMacroState();
    const regime = classifyRegime(state);
    const bias = buildBias(state, regime);
    const intent = detectIntent(state);
    const insight = buildTradingInsight(regime, bias, intent, state.RepoData);

    console.log("Regime:", regime.regime);
    console.log("Bias:", JSON.stringify(bias));
    console.log("Intent:", intent.intent);
    console.log("Stance:", insight.stance);
    console.log("\n--- INSIGHT TEXT ---");
    console.log(insight.text);
    console.log("\n=== TEST COMPLETE ===");
}

testInsight().catch(console.error);
