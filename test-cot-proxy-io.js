const axios = require("axios");

async function test() {
    console.log("=== TESTING CORSPROXY.IO FOR COT ===\n");

    const url = "https://corsproxy.io/?https://cftc.gov/dea/newcot/deafut.txt";
    
    try {
        console.log(`📡 Fetching via proxy: ${url}...`);
        const res = await axios.get(url, {
            timeout: 15000,
            headers: {
                "User-Agent": "PostmanRuntime/7.35.0"
            }
        });
        
        console.log(`✅ SUCCESS! Status: ${res.status}`);
        if (res.data.includes("WHEAT")) {
            console.log("✅ Content verified: Found 'WHEAT' (DXY/FOREX likely present).");
            process.exit(0);
        } else {
            console.log("❌ Content mismatch or empty response.");
        }
    } catch (e) {
        console.error(`❌ FAILED: ${e.response?.status || e.message}`);
    }

    console.log("\n=== TEST COMPLETE (FAILED) ===");
}

test();
