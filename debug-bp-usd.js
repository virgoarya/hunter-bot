const { fetchBabyPipsCalendar } = require("./services/babypipsScraper");

async function debug() {
    const events = await fetchBabyPipsCalendar();
    const today = "2026-03-11";
    const todayEvents = events.filter(e => e.country === "USD" && e.date.includes(today));
    
    console.log(`Found ${todayEvents.length} USD events for ${today} in BabyPips:`);
    todayEvents.forEach(e => {
        console.log(`- ${e.event} | Act: ${e.actual} | Frc: ${e.forecast}`);
    });
}

debug();
