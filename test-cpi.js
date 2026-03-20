const { fetchEconomicCalendar } = require("./services/economicCalendar");

async function testCPI() {
    console.log("--- TARGETED CPI TEST ---");
    const events = await fetchEconomicCalendar(true);
    
    const cpiEvents = events.filter(e => e.country === "USD" && e.event.toUpperCase().includes("CPI"));
    
    console.log(`Found ${cpiEvents.length} CPI events:`);
    cpiEvents.forEach(e => {
        console.log(`- ${e.event} | Actual: ${e.actual} | Source: ${e.source}`);
    });

    const withActuals = cpiEvents.filter(e => e.actual !== "N/A");
    if (withActuals.length > 0) {
        console.log("✅ Success! BabyPips (or AV) provided CPI actuals.");
    } else {
        console.log("❌ Failed. CPI actuals are still N/A.");
    }
}

testCPI();
