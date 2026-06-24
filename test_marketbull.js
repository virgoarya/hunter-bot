const logger = require('../utils/logger');
const { fetchMarketBullCOT } = require('./services/marketBullScraper');

(async () => {
    const keys = ['eur', 'gbp', 'jpy', 'gold', 'usd'];
    for (const key of keys) {
        try {
            const data = await fetchMarketBullCOT(key);
            logger.info(`${key}:`, data ? JSON.stringify(data) : 'null');
        } catch (e) {
            logger.error(`${key} error:`, e.message);
        }
    }
})().catch(e => logger.error(e));
