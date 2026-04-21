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
    console.log('Status:', r.status);
    console.log('Content-Type:', r.headers['content-type']);
    console.log('Body length:', r.data.length);
    // Check for some expected content
    console.log('Has su-column?', r.data.includes('su-column'));
    console.log('Has last_cot_table?', r.data.includes('last_cot_table'));
    console.log('Has Report Date?', r.data.includes('Report Date'));
})
.catch(e => {
    console.error('Error status:', e.response?.status);
    console.error('Message:', e.message);
});
