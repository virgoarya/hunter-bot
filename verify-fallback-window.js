const axios = require("axios");
const { fetchEconomicCalendar } = require("./services/economicCalendar");
const { generateReply } = require("./services/aiResponder");
require("dotenv").config();

// 1. Mock FairEconomy to return 429 (Rate Limited)
const originalGet = axios.get;
axios.get = async (url, config) => {
    if (url.includes("faireconomy.media")) {
        console.log("🛠️ Mocking FairEconomy 429...");
        return { data: "<html>Rate Limited</html>", status: 429 };
    }
    return originalGet(url, config);
};

async function verify() {
    console.log("--- VERIFYING CALENDAR FALLBACK & AI WINDOW ---");
    
    // Test 1: Skeleton Fallback
    console.log("\nTesting skeleton fallback to BabyPips...");
    const calendar = await fetchEconomicCalendar(true); // Force update to trigger fallback
    
    const count = calendar.length;
    const bpSource = calendar.filter(e => e.source === "BabyPips").length;
    
    console.log(`Total events: ${count}`);
    console.log(`BabyPips skeleton events: ${bpSource}`);
    
    if (bpSource > 0 && count > 0) {
        console.log("✅ SUCCESS: BabyPips successfully acted as the fallback skeleton!");
    } else {
        console.log("❌ FAILED: Calendar is empty or didn't use BabyPips as skeleton.");
    }

    // Test 2: AI Window Visibility (Last 12 Hours)
    console.log("\nTesting AI visibility for past events (last 12 hours)...");
    const question = "Berapa data actual CPI hari ini 11 maret 2026? Analisa market berdasarkan data tersebut.";
    
    const reply = await generateReply(question, null);
    console.log("\nAI Reply Preview:");
    console.log(reply.substring(0, 500) + "...");

    const hasPercentage = reply.includes("%");
    const hasCPI = reply.toUpperCase().includes("CPI");
    
    if (hasPercentage && hasCPI && !reply.includes("TIDAK TERSEDIA")) {
        console.log("\n✅ SUCCESS: AI now properly sees and reports the CPI actual data!");
    } else {
        console.log("\n❌ FAILED: AI still claims data is not available or missing percentages.");
    }
}

verify();
