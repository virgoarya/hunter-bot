const axios = require('axios');
require('dotenv').config();

async function testAV() {
    try {
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        console.log("Fetching AV Economic Calendar...");
        const response = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'ECONOMIC_CALENDAR',
                apikey: apiKey
            }
        });

        // AlphaVantage returns CSV for this function sometimes, let's check
        if (typeof response.data === 'string') {
            const lines = response.data.trim().split('\n');
            console.log("Headers:", lines[0]);
            console.log("Sample Row:", lines[1]);

            const pmiMatch = lines.find(l => l.includes('ISM') && l.includes('Manufacturing'));
            if (pmiMatch) console.log("PMI Row:", pmiMatch);
        } else {
            console.log("Response structure:", JSON.stringify(response.data).substring(0, 500));
        }
    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) console.error("Data:", error.response.data);
    }
}

testAV();
