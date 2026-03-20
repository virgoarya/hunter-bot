const { fetchEconomicCalendar } = require("./services/economicCalendar");

async function test() {
    console.log("--- TESTING CPI PERCENTAGE MATCHING ---");
    const events = await fetchEconomicCalendar(true);
    
    const cpiEvents = events.filter(e => e.country === "USD" && e.event.toUpperCase().includes("CPI"));
    
    console.log(`Found ${cpiEvents.length} CPI events in final calendar:`);
    cpiEvents.forEach(e => {
        console.log(`- ${e.event} | Actual: ${e.actual} | Source: ${e.source}`);
    });

    const hasPercentage = cpiEvents.some(e => e.actual.includes("%"));
    if (hasPercentage) {
        console.log("\n✅ Success! Percentage data detected for CPI.");
    } else {
        console.log("\n❌ Failed. Actual data is still index or N/A.");
    }
}

test();
