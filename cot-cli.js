#!/usr/bin/env node

/**
 * COT Data CLI Tool
 * Usage: node cot-cli.js [options]
 *
 * Options:
 *   --format <text|json>    Output format (default: text)
 *   --contracts             List all tracked contracts
 *   --contract <name>       Show specific contract detail
 *   --refresh               Force refresh (skip cache)
 *
 * Examples:
 *   node cot-cli.js                 # Display full COT report
 *   node cot-cli.js --format json   # Output as JSON
 *   node cot-cli.js --contracts     # List tracked contracts
 */

const { fetchCOTData } = require('./services/cotData');

async function main() {
    const args = process.argv.slice(2);
    const format = args.includes('--format=json') ? 'json' : 'text';
    const listContracts = args.includes('--contracts');
    const specificContract = args.find(arg => arg.startsWith('--contract='))?.split('=')[1];
    const forceRefresh = args.includes('--refresh');

    console.log('📊 COT Data CLI\n');

    if (listContracts) {
        console.log('Tracked Contracts:');
        console.log('─────────────────');
        console.log('Forex: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF');
        console.log('Commodity: GOLD, SILVER, OIL');
        console.log('Index: S&P 500, NASDAQ, USD Index');
        console.log('');
        return;
    }

    if (specificContract) {
        const data = await fetchCOTData(forceRefresh);
        if (!data) {
            console.error('❌ Failed to fetch COT data');
            process.exit(1);
        }
        const contract = data.contracts.find(c =>
            c.name.toLowerCase() === specificContract.toLowerCase()
        );
        if (!contract) {
            console.error(`❌ Contract '${specificContract}' not found`);
            process.exit(1);
        }
        console.log(`Contract: ${contract.name} (${contract.category})`);
        console.log('────────────────────────────────────────');
        console.log(`Sentiment: ${contract.sentiment}`);
        console.log(`Speculator Net: ${contract.speculator.net.toLocaleString()}`);
        console.log(`Speculator Long: ${contract.speculator.long.toLocaleString()}`);
        console.log(`Speculator Short: ${contract.speculator.short.toLocaleString()}`);
        console.log(`Commercial Net: ${contract.commercial.net.toLocaleString()}`);
        console.log(`Commercial Long: ${contract.commercial.long.toLocaleString()}`);
        console.log(`Commercial Short: ${contract.commercial.short.toLocaleString()}`);
        console.log(`Open Interest: ${contract.openInterest.toLocaleString()}`);
        if (contract.marketBull) {
            console.log('\n📈 MarketBull Data:');
            console.log(`  COT Index (6M): ${contract.marketBull.cotIndex6M}`);
            console.log(`  COT Index (36M): ${contract.marketBull.cotIndex36M}`);
            console.log(`  Chart URL: ${contract.marketBull.chartUrl}`);
        }
        console.log('');
        return;
    }

    // Full report
    const data = await fetchCOTData(forceRefresh);
    if (!data) {
        console.error('❌ Failed to fetch COT data');
        process.exit(1);
    }

    if (format === 'json') {
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    // Text format
    console.log('═══════════════════════════════════════════════════');
    console.log('  COMMITMENT OF TRADERS (COT) REPORT');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📅 Report Date: ${data.reportDate}`);
    console.log(`🕐 Fetched At: ${new Date(data.fetchedAt).toLocaleString()}`);
    console.log(`📈 Total Contracts: ${data.contracts.length}`);
    console.log('');

    const categories = {
        forex: { title: '💱 FOREX', items: [] },
        commodity: { title: '🏆 COMMODITIES', items: [] },
        index: { title: '📈 INDICES', items: [] }
    };

    data.contracts.forEach(contract => {
        const arrow = contract.sentiment === 'BULLISH' ? '🟢' :
                      contract.sentiment === 'BEARISH' ? '🔴' : '⚪';
        const netStr = contract.speculator.net.toLocaleString();
        const commStr = contract.commercial.net.toLocaleString();
        let line = `${arrow} ${contract.name.padEnd(15)} ${contract.sentiment.padEnd(10)} Net: ${netStr.padStart(10)} | Comm: ${commStr.padStart(10)}`;

        if (contract.marketBull && contract.marketBull.cotIndex6M !== 'N/A') {
            line += ` │ Index6M: ${contract.marketBull.cotIndex6M}`;
        }

        if (categories[contract.category]) {
            categories[contract.category].items.push(line);
        }
    });

    Object.values(categories).forEach(cat => {
        if (cat.items.length > 0) {
            console.log(`\n${cat.title}`);
            console.log('─'.repeat(60));
            cat.items.forEach(item => console.log(item));
        }
    });

    console.log('\n═══════════════════════════════════════════════════');
    console.log('Data Sources:');
    console.log('  • Net Position: CFTC Local Mirror (cot_raw.txt)');
    console.log('  • COT Index: MarketBull Mirror (marketbull_cot.json)');
    console.log('═══════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
