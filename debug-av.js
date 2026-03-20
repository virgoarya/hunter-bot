require("dotenv").config();
const axios = require("axios");

async function debugAV() {
    console.log("--- DEBUGGING ALPHAVANTAGE DATA ---");
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) {
        console.error("No AV API Key found.");
        return;
    }

    try {
        console.log("Fetching AV Calendar...");
        const response = await axios.get("https://www.alphavantage.co/query", {
            params: {
                function: "ECONOMIC_CALENDAR",
                apikey: apiKey
            },
            timeout: 10000
        });

        if (typeof response.data === "string") {
            const lines = response.data.trim().split("\n");
            console.log("Headers:", lines[0]);
            
            const headers = lines[0].split(",").map(h => h.trim());
            const data = lines.slice(1).map(line => {
                const values = line.split(",");
                const entry = {};
                headers.forEach((h, i) => entry[h] = values[i]?.trim());
                return entry;
            });

            console.log("\nLast 5 events in data:");
            data.slice(-5).forEach(e => console.log(JSON.stringify(e)));

            const todayStr = "2026-03-11";
            console.log(`\nSearching for events on ${todayStr}:`);
            const todayEvents = data.filter(e => e.date === todayStr);
            todayEvents.forEach(e => {
                console.log(`- ${e.event} | Date: ${e.date} | Actual: ${e.actual} | Forecast: ${e.forecast || e.estimate}`);
            });
        } else {
            console.log("AV Response (not string):", JSON.stringify(response.data).slice(0, 500));
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

debugAV();
