const { fetchCOTData, formatCOTReport } = require("./services/cotData");

async function testUnifiedCOT() {
    console.log("=== TESTING UNIFIED COT (CFTC + MARKETBULL) ===\n");

    // Force refresh to trigger the scraper
    const data = await fetchCOTData(true);
    
    if (data && data.contracts) {
        console.log(`✅ Fetched COT for ${data.contracts.length} instruments.`);
        console.log(`📅 Report Date: ${data.reportDate}\n`);

        const gold = data.contracts.find(c => c.name === "GOLD");
        if (gold && gold.marketBull) {
            console.log("🏆 GOLD MARKETBULL DATA FOUND:");
            console.log(`   Index (6M): ${gold.marketBull.cotIndex6M}`);
            console.log(`   Net Spec: ${gold.speculator.net}`);
            console.log(`   Chart: ${gold.marketBull.chartUrl}\n`);
        }

        const usd = data.contracts.find(c => c.name === "USD Index");
        if (usd && usd.marketBull) {
            console.log("💵 USD INDEX MARKETBULL DATA FOUND:");
            console.log(`   Index (6M): ${usd.marketBull.cotIndex6M}`);
            console.log(`   Net Spec: ${usd.speculator.net}`);
            console.log(`   Chart: ${usd.marketBull.chartUrl}\n`);
        }

        console.log("--- FORMATTED REPORT SNIPPET ---");
        const report = formatCOTReport(data);
        console.log(report);
    } else {
        console.log("❌ Failed to fetch COT data.");
    }
}

testUnifiedCOT();
