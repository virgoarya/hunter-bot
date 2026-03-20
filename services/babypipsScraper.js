const axios = require("axios");

async function fetchBabyPipsCalendar() {
  try {
    const url = "https://www.babypips.com/economic-calendar?format=json";
    console.log("🍼 Falling back to BabyPips for economic data...");
    
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.babypips.com/economic-calendar"
      },
      timeout: 15000
    });

    if (!response.data || !Array.isArray(response.data.events)) {
      console.warn("⚠️ BabyPips returned invalid JSON or empty events.");
      return [];
    }

    // Map BabyPips format to our standard format
    return response.data.events.map(e => {
      let eventDate = e.starts_at;
      if (typeof eventDate === "number") {
          eventDate = new Date(eventDate * 1000).toISOString();
      } else if (!eventDate) {
          eventDate = new Date().toISOString(); 
      }

      return {
        type: "event",
        source: "BabyPips",
        date: eventDate,
        country: e.currency_code,
        event: e.name,
        impact: mapImpact(e.impact),
        forecast: e.forecast || "N/A",
        previous: e.previous || "N/A",
        actual: e.actual || "N/A"
      };
    });
  } catch (error) {
    console.error("❌ BabyPips scraper error:", error.message);
    return [];
  }
}

function mapImpact(impact) {
  if (!impact) return "Low";
  const i = impact.toLowerCase();
  if (i === "high") return "High";
  if (i === "med" || i === "medium") return "Medium";
  return "Low";
}

module.exports = { fetchBabyPipsCalendar };
