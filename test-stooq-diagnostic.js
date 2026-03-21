const axios = require("axios");

async function diagnostic() {
    const symbol = "dx.f"; // DXY
    const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`;
    
    console.log(`Testing URL: ${url}`);
    
    try {
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            timeout: 10000
        });
        
        console.log("Status:", response.status);
        console.log("Raw Response:\n", response.data);
        
        const lines = response.data.trim().split("\n");
        if (lines.length < 2) {
            console.log("Only header found or empty response.");
            return;
        }
        
        const values = lines[1].split(",");
        console.log("Split Values:", values);
        
        const close = parseFloat(values[6]);
        console.log("Close Price parsed:", close);
        
    } catch (e) {
        console.error("Diagnostic Error:", e.message);
    }
}

diagnostic();
