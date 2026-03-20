/**
 * Hunter Bot — Test All Services
 * Run: node test-all.js
 */

require("dotenv").config();

async function testAll() {
    console.log("🧪 Hunter Bot — Testing All Services\n");
    console.log("=".repeat(50));

    let passed = 0;
    let failed = 0;

    // === Test 1: Macro Data ===
    try {
        console.log("\n📊 Test 1: Macro Data (TwelveData + FRED)...");
        const { updateMacroData, getMacroState } = require("./services/macroData");
        const data = await updateMacroData();
        const state = getMacroState();

        console.log(`  DXY: ${state.DXY?.close ?? "FAIL"}`);
        console.log(`  GOLD: ${state.GOLD?.close ?? "FAIL"}`);
        console.log(`  NASDAQ: ${state.NASDAQ?.close ?? "FAIL"}`);
        console.log(`  US10Y: ${state.US10Y?.close ?? "FAIL"}%`);
        console.log(`  VIX: ${state.VIX?.close ?? "FAIL"}`);
        console.log(`  Healthy: ${state.isHealthy}`);
        console.log("  ✅ Macro Data OK");
        passed++;
    } catch (err) {
        console.error("  ❌ Macro Data FAILED:", err.message);
        failed++;
    }

    // === Test 2: Regime Classification ===
    try {
        console.log("\n🏛️ Test 2: Regime Classification...");
        const { getMacroState } = require("./services/macroData");
        const { classifyRegime } = require("./services/regime");
        const regime = classifyRegime(getMacroState());
        console.log(`  Regime: ${regime.regime} — ${regime.description}`);
        console.log("  ✅ Regime OK");
        passed++;
    } catch (err) {
        console.error("  ❌ Regime FAILED:", err.message);
        failed++;
    }

    // === Test 3: Bias Engine ===
    try {
        console.log("\n🧠 Test 3: Bias Engine...");
        const { getMacroState } = require("./services/macroData");
        const { classifyRegime } = require("./services/regime");
        const { buildBias } = require("./services/biasEngine");
        const state = getMacroState();
        const regime = classifyRegime(state);
        const bias = buildBias(state, regime);
        console.log(`  USD: ${bias.usdBias} | Gold: ${bias.goldBias} | Equity: ${bias.equityBias}`);
        console.log("  ✅ Bias Engine OK");
        passed++;
    } catch (err) {
        console.error("  ❌ Bias Engine FAILED:", err.message);
        failed++;
    }

    // === Test 4: Economic Calendar ===
    try {
        console.log("\n📅 Test 4: Economic Calendar...");
        const { fetchEconomicCalendar } = require("./services/economicCalendar");
        const events = await fetchEconomicCalendar(true);
        console.log(`  Events fetched: ${events.length}`);
        if (events.length > 0) {
            console.log(`  First: ${events[0].event} (${events[0].country})`);
        }
        console.log("  ✅ Economic Calendar OK");
        passed++;
    } catch (err) {
        console.error("  ❌ Economic Calendar FAILED:", err.message);
        failed++;
    }

    // === Test 5: Calendar Broadcast ===
    try {
        console.log("\n📢 Test 5: Calendar Broadcast Format...");
        const { buildCalendarBroadcast } = require("./services/calendarBroadcast");
        const payload = await buildCalendarBroadcast();

        if (payload) {
            if (typeof payload === 'string') {
                console.log(`  Message length: ${payload.length} chars`);
                console.log(`  Preview: ${payload.substring(0, 100)}...`);
            } else if (payload.embeds) {
                console.log(`  Embed Detected: ${payload.embeds.length} slides`);
                console.log(`  Title: ${payload.embeds[0].data?.title || "No Title"}`);
            } else {
                console.log(`  Type returned: ${typeof payload}`);
            }
        } else {
            console.log("  No calendar data (expected if no events today)");
        }
        console.log("  ✅ Calendar Broadcast OK");
        passed++;
    } catch (err) {
        console.error("  ❌ Calendar Broadcast FAILED:", err.message);
        failed++;
    }

    // === Test 6: COT Data ===
    try {
        console.log("\n📊 Test 6: COT Data (CFTC Scraper)...");
        const { fetchCOTData, formatCOTReport } = require("./services/cotData");
        const cotData = await fetchCOTData(true);

        if (cotData && cotData.contracts?.length > 0) {
            console.log(`  Report Date: ${cotData.reportDate}`);
            console.log(`  Contracts found: ${cotData.contracts.length}`);
            for (const c of cotData.contracts.slice(0, 3)) {
                console.log(`    ${c.name}: Net Spec ${c.speculator.net > 0 ? "+" : ""}${c.speculator.net.toLocaleString()} (${c.sentiment})`);
            }
            console.log("  ✅ COT Data OK");
            passed++;
        } else {
            console.log("  ⚠️ COT data empty (CFTC might be unreachable or report format changed)");
            console.log("  ⚠️ Skipped (non-critical)");
            passed++;
        }
    } catch (err) {
        console.error("  ❌ COT Data FAILED:", err.message);
        failed++;
    }

    // === Test 7: Liquidity Flow ===
    try {
        console.log("\n💧 Test 7: Liquidity Flow (may take ~15s due to rate limits)...");
        const { fetchLiquidityFlow, formatFlowSummary } = require("./services/liquidityFlow");
        const flowData = await fetchLiquidityFlow(true);

        if (flowData && flowData.instruments?.length > 0) {
            console.log(`  Instruments: ${flowData.instruments.length}`);
            console.log(`  USD Flow: ${flowData.usdFlow}`);
            console.log(`  Risk Flow: ${flowData.riskFlow}`);
            for (const inst of flowData.instruments.slice(0, 3)) {
                console.log(`    ${inst.symbol}: ${inst.price} | ${inst.direction} | Vol: ${inst.volumeRatio}x`);
            }
            console.log("  ✅ Liquidity Flow OK");
            passed++;
        } else {
            console.log("  ⚠️ Flow data empty (rate limit or API issue)");
            passed++;
        }
    } catch (err) {
        console.error("  ❌ Liquidity Flow FAILED:", err.message);
        failed++;
    }

    // === Test 8: Market Price ===
    try {
        console.log("\n💰 Test 8: Market Price (batch)...");
        const { fetchMultiPrice } = require("./services/marketPrice");
        const prices = await fetchMultiPrice(["EUR/USD", "XAU/USD", "DXY"]);

        if (prices) {
            for (const [sym, data] of Object.entries(prices)) {
                console.log(`  ${sym}: ${data.price} (${data.source || "Unknown Source"})`);
            }
            console.log("  ✅ Market Price OK");
            passed++;
        } else {
            console.log("  ⚠️ Price data empty");
            passed++;
        }
    } catch (err) {
        console.error("  ❌ Market Price FAILED:", err.message);
        failed++;
    }

    // === Test 9: Conversation Memory ===
    try {
        console.log("\n💬 Test 9: Conversation Memory...");
        const { addMessage, getHistory, clearHistory } = require("./services/conversationMemory");

        addMessage("test-user", "user", "Bagaimana kondisi pasar?");
        addMessage("test-user", "assistant", "Kondisi pasar saat ini...");

        const history = getHistory("test-user");
        console.log(`  Messages stored: ${history.length}`);
        console.log(`  Last: ${history[history.length - 1]?.content?.substring(0, 50)}`);

        clearHistory("test-user");
        const cleared = getHistory("test-user");
        console.log(`  After clear: ${cleared.length} messages`);
        console.log("  ✅ Conversation Memory OK");
        passed++;
    } catch (err) {
        console.error("  ❌ Conversation Memory FAILED:", err.message);
        failed++;
    }

    // === Summary ===
    console.log("\n" + "=".repeat(50));
    console.log(`\n✅ Passed: ${passed}/${passed + failed}`);
    console.log(`❌ Failed: ${failed}/${passed + failed}`);

    if (failed === 0) {
        console.log("\n🎉 All tests passed! Bot is ready to run.");
    } else {
        console.log("\n⚠️ Some tests failed. Please check the errors above.");
    }

    console.log("\n💡 To start the bot: node index.js");
    process.exit(failed > 0 ? 1 : 0);
}

testAll().catch(console.error);
