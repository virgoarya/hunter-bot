const { fetchStooqPrice } = require("./services/stooqService");

async function test() {
    console.log("=== TESTING STOOQ COT SYMBOLS ===\n");

    const symbols = ["EUR_C.C", "GBP_C.C", "GOLD_C.C", "CL_C.C"];
    
    for (const sym of symbols) {
        console.log(`Checking ${sym}...`);
        const data = await fetchStooqPrice(sym);
        if (data) {
            console.log(`✅ ${sym}: ${data.close} (Date: ${data.date})`);
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(`❌ ${sym}: FAILED`);
        }
        console.log("---");
    }

    console.log("\n=== TEST COMPLETE ===");
}

test();
