const axios = require('axios');

async function fetchRepoData() {
    try {
        const url = 'https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json';
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "HunterBot/1.0"
            },
            timeout: 10000
        });

        const ops = response.data?.repo?.operations;
        if (!ops || !Array.isArray(ops) || ops.length < 2) {
            throw new Error("Struktur data NY Fed tidak sesuai atau data tidak cukup.");
        }

        // Filter only Reverse Repo
        const reverseRepos = ops.filter(op => op.operationType === 'Reverse Repo');
        if (reverseRepos.length < 2) {
            return { error: 'Tidak ada data Reverse Repo yang cukup.' };
        }

        const latest = reverseRepos[0];
        const previous = reverseRepos[1];

        // totalAmtAccepted is in Dollars, let's convert to Billions
        const currentBil = (latest.totalAmtAccepted / 1000000000).toFixed(2);
        const prevBil = (previous.totalAmtAccepted / 1000000000).toFixed(2);
        
        const changePercent = (((latest.totalAmtAccepted - previous.totalAmtAccepted) / previous.totalAmtAccepted) * 100).toFixed(2);
        
        let direction = "SIDEWAYS";
        if (changePercent > 1) direction = "NAIK (Risk-Off)";
        else if (changePercent < -1) direction = "TURUN (Risk-On)";

        return {
            date: latest.operationDate,
            amountBillion: currentBil,
            amount: latest.totalAmtAccepted,
            changePercent: changePercent,
            direction: direction,
            raw: latest
        };
    } catch (error) {
        console.error("Repo Data fetch error:", error.message);
        return { error: error.message };
    }
}

module.exports = { fetchRepoData };
