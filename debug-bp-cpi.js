const { fetchBabyPipsCalendar } = require("./services/babypipsScraper");

async function debug() {
    const events = await fetchBabyPipsCalendar();
    const cpiEvents = events.filter(e => e.country === "USD" && e.event.toUpperCase().includes("CPI"));
    
    console.log(`Found ${cpiEvents.length} USD CPI events in BabyPips:`);
    cpiEvents.forEach(e => {
        console.log(JSON.stringify(e, null, 2));
    });
}

debug();
