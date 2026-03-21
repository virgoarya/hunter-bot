const axios = require('axios');

async function testRepoAPI() {
    try {
        const url = 'https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json';
        const res = await axios.get(url, { timeout: 10000 });
        console.log("Status:", res.status);
        console.log(JSON.stringify(res.data).substring(0, 1000));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testRepoAPI();
