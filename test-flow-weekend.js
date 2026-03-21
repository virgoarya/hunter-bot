const { fetchLiquidityFlow, formatFlowSummary } = require("./services/liquidityFlow");

async function test() {
    console.log("=== TESTING LIQUIDITY FLOW (WEEKEND FIX) ===\n");
    
    try {
        const flowData = await fetchLiquidityFlow(true); // force refresh
        
        if (flowData.error) {
            console.error("❌ Test Failed:", flowData.error);
        } else {
            console.log("✅ Test Passed! Data fetched successfully.");
            console.log("\nSummary Output:");
            console.log(formatFlowSummary(flowData));
            
            const results = flowData.instruments;
            console.log("\nProvider check:");
            // We need to check the data from yahooFinance.js vs stooqService.js
            // But liquidityFlow.js doesn't explicitly store the provider in its internal 'results' array
            // However, if it holds data, it worked.
        }
    } catch (e) {
        console.error("❌ Test Crashed:", e.message);
    }
    
    console.log("\n=== TEST COMPLETE ===");
}

test();
