const axios = require("axios");

const TEST_INSTANCES = [
    "https://nitter.net",
    "https://nitter.privacydev.net",
    "https://nitter.project_segfault.org",
    "https://nitter.rawbit.ninja",
    "https://nitter.esmailelbob.xyz",
    "https://nitter.tt.metu.edu.tr",
    "https://nitter.privacy.com.de",
    "https://nitter.nohost.me",
    "https://nitter.it",
    "https://nitter.mint.lgbt",
    "https://nitter.perennialte.ch"
];

async function testInstances() {
    console.log("=== TESTING NITTER INSTANCES FOR RSS ===\n");
    
    for (const base of TEST_INSTANCES) {
        const url = `${base}/KobeissiLetter/rss`;
        try {
            console.log(`📡 Probing: ${url}...`);
            const res = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                },
                timeout: 8000
            });
            
            if (res.status === 200 && res.data.includes("<rss")) {
                console.log(`✅ SUCCESS: ${base} is working!`);
            } else {
                console.log(`❌ FAILED: ${base} returned status ${res.status} or invalid XML.`);
            }
        } catch (e) {
            console.log(`❌ FAILED: ${base} - ${e.message}`);
        }
    }
}

testInstances();
