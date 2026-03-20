require("dotenv").config();
const { fetchEconomicCalendar } = require("./services/economicCalendar");
const { buildCalendarBroadcast } = require("./services/calendarBroadcast");

async function testCalendar() {
    console.log("📅 Testing New Weekly Calendar Format...\n");

    try {
        console.log("1. Fetching data (7-day range)...");
        const events = await fetchEconomicCalendar(true);
        console.log(`   Fetched ${events.length} total items.`);

        console.log("\n2. Building broadcast message...");
        const msg = await buildCalendarBroadcast();

        console.log("\n--- MESSAGE PREVIEW ---");
        console.log(msg);
        console.log("--- END PREVIEW ---\n");

        if (msg && msg.includes("WEEKLY CALENDAR")) {
            console.log("✅ Test PASSED: Weekly format detected.");
        } else {
            console.log("❌ Test FAILED: Format not as expected.");
        }
    } catch (err) {
        console.error("❌ Test ERROR:", err.message);
    }
}

testCalendar().catch(console.error);
