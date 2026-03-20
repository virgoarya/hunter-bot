require("dotenv").config();
const { fetchEconomicCalendar } = require("./services/economicCalendar");
const { getNewReleaseAlerts } = require("./services/calendarBroadcast");

async function debug() {
    console.log("--- DEBUGGING CALENDAR ALERTS ---");
    const now = new Date();
    console.log("Bot Local Time:", now.toString());
    console.log("todayStr:", now.toISOString().split("T")[0]);

    console.log("\n1. Fetching Calendar (Force Refresh)...");
    const events = await fetchEconomicCalendar(true);
    
    console.log(`\nTotal events: ${events.length}`);
    
    const todayEvents = events.filter(e => {
        if (e.type !== "event") return false;
        const todayStr = now.toISOString().split("T")[0];
        const isToday = e.date.includes(todayStr) || new Date(e.date).toDateString() === now.toDateString();
        return isToday;
    });

    console.log(`Events today: ${todayEvents.length}`);
    
    todayEvents.forEach(e => {
        console.log(`[${e.impact}] ${e.country}: ${e.event} | Time: ${e.date} | Actual: ${e.actual} | Forecast: ${e.forecast}`);
    });

    console.log("\n2. Testing getNewReleaseAlerts()...");
    const alerts = await getNewReleaseAlerts();
    console.log(`Alerts generated: ${alerts.length}`);
}

debug();
