require("dotenv").config();
const { updateMacroData, getMacroState } = require("./services/macroData");
const { classifyRegime } = require("./services/regime");
const { buildBias } = require("./services/biasEngine");
const { detectIntent } = require("./services/intentEngine");

async function verifyBiases() {
    console.log("🔍 Verifying Biases and Intent... \n");

    try {
        console.log("📡 Refreshing Macro Data...");
        const state = await updateMacroData();

        console.log("\n📊 Macro Context:");
        console.log(`- DXY: ${state.DXY?.close}`);
        console.log(`- VIX: ${state.VIX?.close} (${state.VIX?.change}%)`);
        console.log(`- US10Y: ${state.US10Y?.close}%`);
        console.log(`- RealYield: ${state.RealYield?.close}%`);

        const regime = classifyRegime(state);
        console.log(`\n🚩 Regime: ${regime.regime}`);

        const bias = buildBias(state, regime);
        console.log(`\n📈 Biases:`);
        console.log(`- USD: ${bias.usdBias}`);
        console.log(`- Gold: ${bias.goldBias}`);
        console.log(`- Equities: ${bias.equityBias}`);

        const intent = detectIntent(state);
        console.log(`\n🧠 Intent: ${intent.intent}`);
        console.log(`   Description: ${intent.description}`);

        const allNeutral = bias.usdBias === "Neutral" && bias.goldBias === "Neutral" && bias.equityBias === "Neutral";
        if (allNeutral) {
            console.log("\n❌ FAIL: All biases are still Neutral.");
        } else {
            console.log("\n✅ SUCCESS: Biases are now showing directional signals.");
        }

    } catch (err) {
        console.error("❌ Diagnostic failed:", err);
    }
}

verifyBiases();
