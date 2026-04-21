const { fetchMarketBullCOT } = require('./services/marketBullScraper');

(async () => {
    const keys = ['eur', 'gbp', 'jpy', 'gold', 'usd'];
    for (const key of keys) {
        try {
            const data = await fetchMarketBullCOT(key);
            console.log(`${key}:`, data ? JSON.stringify(data) : 'null');
        } catch (e) {
            console.error(`${key} error:`, e.message);
        }
    }
})().catch(e => console.error(e));
