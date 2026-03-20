require("dotenv").config();
const { fetchEconomicCalendar } = require("./services/economicCalendar");

function formatCalendarItem(item) {
  const source = item?.source ? `[${item.source}] ` : "";
  let dateStr = "N/A";
  
  try {
    if (item?.date) {
      const d = new Date(item.date);
      dateStr = d.toLocaleString("id-ID", {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: "Asia/Jakarta"
      }) + " WIB";
    }
  } catch (e) {
    dateStr = item?.date || "N/A";
  }

  const country = item?.country || "N/A";
  const event = item?.event || "N/A";
  const actual = item?.actual ?? "?";
  const forecast = item?.forecast ?? "?";
  const previous = item?.previous ?? "?";

  if (item?.type === "news") {
    return `- ${source}[${dateStr}] ${event} | Sentiment: ${actual}`;
  }

  return `- ${source}[${dateStr}] ${country}: ${event} (Act: ${actual}, Frc: ${forecast}, Prev: ${previous})`;
}

async function debugPrompt() {
    console.log("--- DEBUGGING AI CALENDAR PROMPT ---");
    const calendar = await fetchEconomicCalendar(true); // Force refresh
    
    const now = new Date();
    // Simulate what's in aiResponder.js
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endWindow = startOfToday + (4 * 24 * 60 * 60 * 1000);
    
    console.log(`Now: ${now.toISOString()}`);
    console.log(`Start of Today (Local): ${new Date(startOfToday).toISOString()}`);
    
    const filteredCalendar = calendar.filter(e => {
        if (!e.date) return false;
        const eventTime = new Date(e.date).getTime();
        return eventTime >= startOfToday && eventTime <= endWindow;
    });

    console.log(`Filtered Calendar count: ${filteredCalendar.length}`);
    const calendarText = filteredCalendar.length > 0
      ? filteredCalendar.map(e => formatCalendarItem(e)).join("\n")
      : "No major events.";

    console.log("\n--- CALENDAR TEXT IN PROMPT ---");
    console.log(calendarText);
    console.log("-------------------------------\n");
    
    const cpiItems = filteredCalendar.filter(e => e.event.toUpperCase().includes("CPI"));
    console.log(`Found ${cpiItems.length} CPI items in filtered list.`);
}

debugPrompt();
