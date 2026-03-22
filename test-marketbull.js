const { fetchMarketBullCOT } = require("./services/marketBullScraper");

async function testScraper() {
    console.log("=== TESTING MARKETBULL COT SCRAPER ===\n");

    const assets = ["gold", "usd"];

    for (const asset of assets) {
        console.log(`📡 Fetching ${asset.toUpperCase()} COT...`);
        const data = await fetchMarketBullCOT(asset);

        if (data) {
            console.log(`✅ Success for ${asset}:`);
            console.log(`   COT Index (6M): ${data.cotIndex6M}`);
            console.log(`   COT Index (36M): ${data.cotIndex36M}`);
            console.log(`   Net Position: ${data.netPosition}`);
            console.log(`   Last Update: ${data.lastUpdate}`);
            console.log(`   Chart URL: ${data.chartUrl}\n`);
        } else {
            console.log(`❌ Failed to fetch ${asset}\n`);
        }
    }
}

testScraper();
