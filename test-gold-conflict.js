const { buildBias } = require("./services/biasEngine");
const { buildTradingInsight } = require("./services/tradingInsight");

function test() {
    console.log("=== TESTING GOLD-USD CONFLICT REFINEMENT ===\n");

    // 1. Simulate the User's Scenario: DXY Bullish & ON RRP Rising
    const macroState = {
        DXY: { close: 102.5 }, // Bullish DXY
        US10Y: { close: 4.3 }, // High Yield
        RealYield: { close: 1.8 }, // Normal/Highish
        VIX: { close: 21 }, // Defensive
        NASDAQ: { close: 18000, change: -1.0 }, 
        GOLD: { close: 2150, change: -0.5 },
        RepoData: { amountBillion: 600, changePercent: "15.0" } // ON RRP Rising (Risk-Off)
    };

    const regime = { regime: "Defensif 🛡️", description: "DXY > 102.0. ON RRP meningkat." };
    
    console.log("Input: DXY=102.5, ON RRP Change=+15%, Regime=Defensif");
    
    const bias = buildBias(macroState, regime);
    console.log("\nCalculated Biases:");
    console.log(`USD: ${bias.usdBias}`);
    console.log(`Gold: ${bias.goldBias}`);
    console.log(`Equity: ${bias.equityBias}`);

    const insight = buildTradingInsight(regime, bias, macroState.RepoData);
    console.log("\nGenerated Trading Insight:");
    console.log(insight.text);

    // Assertions
    if (bias.goldBias.includes("Bearish") && insight.text.includes("SELL / SHORT")) {
        console.log("\n✅ Test Passed: Gold correctly identified as BEARISH due to USD dominance despite rising ON RRP.");
    } else {
        console.error("\n❌ Test Failed: Gold logic still conflicting.");
    }

    console.log("\n=== TEST COMPLETE ===");
}

test();
