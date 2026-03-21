const axios = require("axios");

async function test() {
    console.log("=== TESTING COT FALLBACK METHODS ===\n");

    const urls = [
        "https://cftc.gov/dea/newcot/deafut.txt", // No www
        "https://www.cftc.gov/dea/newcot/c_disagg.txt", // Disaggregated
        "https://www.cftc.gov/sites/default/files/files/dea/history/deafut26.zip" // Archive
    ];

    const uas = [
        "PostmanRuntime/7.35.0",
        "curl/7.81.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ];

    for (const url of urls) {
        for (const ua of uas) {
            console.log(`Checking ${url} with UA: ${ua.substring(0, 20)}...`);
            try {
                const res = await axios.get(url, {
                    timeout: 8000,
                    headers: { "User-Agent": ua },
                    responseType: url.endsWith(".zip") ? "arraybuffer" : "text"
                });
                console.log(`✅ SUCCESS! Status: ${res.status}`);
                if (url.endsWith(".zip")) {
                    console.log(`Zip Data size: ${res.data.byteLength} bytes.`);
                } else if (res.data.includes("WHEAT")) {
                    console.log(`✅ Content verified: Found 'WHEAT' (DXY/FOREX likely present).`);
                }
                process.exit(0); // Exit on first success
            } catch (e) {
                console.log(`❌ FAILED: ${e.response?.status || e.message}`);
            }
        }
    }

    console.log("\n=== TEST COMPLETE (ALL FAILED) ===");
}

test();
