const { fetchEconomicCalendar } = require("./services/economicCalendar");
const { fetchBabyPipsCalendar } = require("./services/babypipsScraper");

async function test() {
    console.log("--- TESTING BABYPIPS SCRAPER ---");
    const bpData = await fetchBabyPipsCalendar();
    console.log(`Fetched ${bpData.length} events from BabyPips.`);
    if (bpData.length > 0) {
        console.log("Sample BabyPips event:", JSON.stringify(bpData[0], null, 2));
    }

    console.log("\n--- TESTING INTEGRATED CALENDAR ---");
    const events = await fetchEconomicCalendar(true); // Force refresh to trigger supplements
    
    // Check if any event has BabyPips data or if any event that was N/A now has data
    const supplemented = events.filter(e => e.actual !== "N/A");
    console.log(`Total events with actual data: ${supplemented.length}`);
    
    const countBP = events.filter(e => e.source === "BabyPips").length;
    console.log(`Events purely from BabyPips (if any): ${countBP}`);

    console.log("\nTop 10 Events with Actuals:");
    events.slice(0, 15).forEach(e => {
        console.log(`[${e.impact}] ${e.country}: ${e.event} | Actual: ${e.actual} | Source: ${e.source}`);
    });
}

test();
