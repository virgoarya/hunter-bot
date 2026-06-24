const logger = require('../utils/logger');
const { fetchCOTData } = require('./services/cotData');

(async () => {
    const data = await fetchCOTData(true);
    if (!data) {
        logger.info('❌ No data');
        process.exit(1);
    }
    logger.info(`📊 Total contracts: ${data.contracts.length}`);
    logger.info(`📅 Report date: ${data.reportDate}\n`);
    logger.info('Details:');
    data.contracts.forEach(c => {
        const mb = c.marketBull ? `| Index: ${c.marketBull.cotIndex6M}` : '';
        logger.info(`${c.name} (${c.category}): ${c.sentiment} | Spec: ${c.speculator.net} | Comm: ${c.commercial.net} ${mb}`);
    });
})().catch(e => {
    logger.error('Error:', e);
    process.exit(1);
});
