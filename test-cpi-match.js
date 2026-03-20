const axios = require("axios");
const { fetchBabyPipsCalendar } = require("./services/babypipsScraper");

async function testCPIMatching() {
    console.log("--- ROBUST CPI MATCHING TEST ---");
    
    // 1. Mock FairEconomy data (Skeleton)
    const mockFE = [
        {
            type: "event",
            source: "FairEconomy",
            date: "2026-03-11T08:30:00-04:00",
            country: "USD",
            event: "Core CPI m/m",
            impact: "High",
            forecast: "0.2%",
            previous: "0.4%",
            actual: "N/A"
        },
        {
            type: "event",
            source: "FairEconomy",
            date: "2026-03-11T08:30:00-04:00",
            country: "USD",
            event: "CPI y/y",
            impact: "High",
            forecast: "2.4%",
            previous: "2.1%",
            actual: "N/A"
        }
    ];

    console.log("Mock FairEconomy data loaded.");

    // 2. Fetch real BabyPips data
    const bpCal = await fetchBabyPipsCalendar();
    console.log(`Fetched ${bpCal.length} real events from BabyPips.`);

    // 3. Apply matching logic (identical to economicCalendar.js)
    const processed = mockFE.map(baseEvent => {
        const feDateStr = baseEvent.date.split("T")[0];
        
        const bpMatch = bpCal.find(bp => {
            if (!bp.date || !bp.event) return false;
            const dateMatch = bp.date.includes(feDateStr);
            const nameMatch = baseEvent.event.toUpperCase().includes(bp.event.toUpperCase()) ||
                              bp.event.toUpperCase().includes(baseEvent.event.toUpperCase());
            return dateMatch && nameMatch;
        });

        if (bpMatch && bpMatch.actual && bpMatch.actual !== "--" && bpMatch.actual !== "N/A") {
            baseEvent.actual = bpMatch.actual;
            baseEvent.matchedSource = "BabyPips";
        }
        return baseEvent;
    });

    console.log("\nResults:");
    processed.forEach(e => {
        console.log(`- ${e.event} | Actual: ${e.actual} | Matched: ${e.matchedSource || "No"}`);
    });

    if (processed.some(e => e.actual !== "N/A")) {
        console.log("\n✅ SUCCESS: BabyPips data successfully matched with FairEconomy skeleton!");
    } else {
        console.log("\n❌ FAILED: No match found. Check naming or date overlap.");
    }
}

testCPIMatching();
