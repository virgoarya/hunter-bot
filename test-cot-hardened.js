const { fetchCOTData, formatCOTReport } = require("./services/cotData");

async function test() {
    console.log("=== TESTING COT DATA FETCHING (HARDENED) ===\n");
    
    try {
        const cotData = await fetchCOTData(true); // force refresh
        
        if (!cotData || !cotData.contracts || cotData.contracts.length === 0) {
            console.error("❌ Test Failed: No data fetched or parsing error.");
        } else {
            console.log("✅ Test Passed! COT data fetched and parsed successfully.");
            console.log(`Report Date: ${cotData.reportDate}`);
            console.log(`Contracts Found: ${cotData.contracts.length}`);
            
            console.log("\nSample Output:");
            console.log(formatCOTReport(cotData).substring(0, 500) + "...");
        }
    } catch (e) {
        console.error("❌ Test Crashed:", e.message);
    }
    
    console.log("\n=== TEST COMPLETE ===");
}

test();
