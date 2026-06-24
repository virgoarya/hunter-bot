const logger = require('../utils/logger');
const axios = require('axios');
const url = 'https://market-bulls.com/cot-report-gold/';
axios.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    },
    timeout: 10000
})
.then(r => {
    logger.info('Status:', r.status);
    logger.info('Content-Type:', r.headers['content-type']);
    logger.info('Body length:', r.data.length);
    // Check for some expected content
    logger.info('Has su-column?', r.data.includes('su-column'));
    logger.info('Has last_cot_table?', r.data.includes('last_cot_table'));
    logger.info('Has Report Date?', r.data.includes('Report Date'));
})
.catch(e => {
    logger.error('Error status:', e.response?.status);
    logger.error('Message:', e.message);
});
