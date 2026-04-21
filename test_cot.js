const { fetchCOTData } = require('./services/cotData');

(async () => {
    const data = await fetchCOTData(true);
    if (!data) {
        console.log('❌ No data');
        process.exit(1);
    }
    console.log(`📊 Total contracts: ${data.contracts.length}`);
    console.log(`📅 Report date: ${data.reportDate}\n`);
    console.log('Details:');
    data.contracts.forEach(c => {
        const mb = c.marketBull ? `| Index: ${c.marketBull.cotIndex6M}` : '';
        console.log(`${c.name} (${c.category}): ${c.sentiment} | Spec: ${c.speculator.net} | Comm: ${c.commercial.net} ${mb}`);
    });
})().catch(e => {
    console.error('Error:', e);
    process.exit(1);
});
