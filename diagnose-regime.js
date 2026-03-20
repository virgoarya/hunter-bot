require("dotenv").config();
const { updateMacroData, getMacroState } = require("./services/macroData");
const { classifyRegime } = require("./services/regime");

async function diagnoseRegime() {
    console.log("🔍 Diagnosing Macro Regime...");

    try {
        console.log("📡 Fetching Macro Data...");
        const state = await updateMacroData();

        console.log("\n📊 Macro State:");
        console.log(JSON.stringify(state, null, 2));

        console.log("\n🧠 Classifying Regime...");
        const regimeInfo = classifyRegime(state);

        console.log("\n🚩 RESULT:");
        console.log(`Regime: ${regimeInfo.regime}`);
        console.log(`Description: ${regimeInfo.description}`);

        if (regimeInfo.regime === "Neutral") {
            console.log("\n💡 Analysis: The regime is Neutral because it didn't hit any of the specialized thresholds.");
            console.log("Current Thresholds in regime.js:");
            console.log("- Panic Mode: VIX > 25 && US10Y > 4.2");
            console.log("- Liquidity Stress: VIX > 20 && US10Y > 4.0");
            console.log("- Defensive: VIX >= 17 && US10Y >= 4.0 && DXY >= 97");
            console.log("- Growth: VIX < 15 && US10Y < 3.8");
        }

    } catch (err) {
        console.error("❌ Diagnostic failed:", err);
    }
}

diagnoseRegime();
