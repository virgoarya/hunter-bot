const { fetchStooqPrice } = require("./services/stooqService");
const { fetchYahooPrice } = require("./services/yahooFinance");

async function test() {
    console.log("=== TESTING DXY PRICE SOURCE ===\n");

    const stooq = await fetchStooqPrice("DXY");
    console.log("Stooq (dx.f):", stooq ? `${stooq.close} (Date: ${stooq.date})` : "FAILED");

    const yahoo = await fetchYahooPrice("DXY");
    console.log("Yahoo (DX-Y.NYB):", yahoo ? `${yahoo.close} (Symbol: ${yahoo.symbol})` : "FAILED");

    console.log("\n=== TEST COMPLETE ===");
}

test();
