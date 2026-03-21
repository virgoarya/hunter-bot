const { fetchStooqPrice } = require("./services/stooqService");

async function test() {
    console.log("=== TESTING STOOQ DXY SYMBOLS ===\n");

    const dxF = await fetchStooqPrice("dx.f");
    console.log("dx.f (Futures):", dxF ? `${dxF.close} (Date: ${dxF.date})` : "FAILED");

    // Try a direct call with usd_i
    const usdI = await fetchStooqPrice("usd_i");
    console.log("usd_i (Spot Index):", usdI ? `${usdI.close} (Date: ${usdI.date})` : "FAILED");

    console.log("\n=== TEST COMPLETE ===");
}

test();
