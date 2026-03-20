const { fetchEconomicCalendar } = require("./services/economicCalendar");
const axios = require("axios");
const { fetchBabyPipsCalendar } = require("./services/babypipsScraper");

// Mock axios to return a "FairEconomy" skeleton with an index value
const originalGet = axios.get;
axios.get = async (url, config) => {
    if (url.includes("ff_calendar_thisweek.json")) {
        return {
            data: [
                {
                    country: "USD",
                    title: "CPI y/y",
                    date: "2026-03-11T12:30:00Z",
                    impact: "High",
                    forecast: "2.4%",
                    previous: "2.4%",
                    actual: "326.79" // RAW INDEX instead of percentage
                }
            ]
        };
    }
    return originalGet(url, config);
};

async function verify() {
    console.log("--- VERIFYING CPI PERCENTAGE OVERRIDE ---");
    
    // We expect fetchEconomicCalendar to see "326.79" as an index and replace it with BabyPips' "2.4%"
    const events = await fetchEconomicCalendar(true);
    
    const cpiIndex = events.find(e => e.event === "CPI y/y");
    
    if (cpiIndex) {
        console.log(`Event: ${cpiIndex.event}`);
        console.log(`Final Actual: ${cpiIndex.actual}`);
        
        if (cpiIndex.actual.includes("%") || cpiIndex.actual === "2.4%") {
            console.log("\n✅ SUCCESS: Index '326.79' was successfully overridden by BabyPips' percentage!");
        } else {
            console.log("\n❌ FAILED: Index '326.79' is still present.");
        }
    } else {
        console.log("❌ FAILED: CPI y/y event not found.");
    }
}

verify();
