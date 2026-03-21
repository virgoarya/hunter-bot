const axios = require("axios");

async function diagnostic() {
    const symbol = "DX=F"; // DXY
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    
    console.log(`Testing URL: ${url}`);
    
    try {
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            timeout: 10000
        });
        
        console.log("Status:", response.status);
        console.log("Data Summary:", JSON.stringify(response.data, null, 2).substring(0, 500));
        
        const result = response.data?.chart?.result?.[0];
        if (result) {
            console.log("Price found:", result.meta.regularMarketPrice);
        } else {
            console.log("No result array found on weekend?");
        }
    } catch (e) {
        console.error("Diagnostic Error:", e.message);
        if (e.response) {
            console.error("Status Code:", e.response.status);
            console.error("Headers:", e.response.headers);
            console.error("Data:", e.response.data);
        }
    }
}

diagnostic();
