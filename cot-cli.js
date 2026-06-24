const logger = require("../utils/logger");

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

    logger.info('📊 COT Data CLI\n');

    if (listContracts) {
        logger.info('Tracked Contracts:');
        logger.info('─────────────────');
        logger.info('Forex: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF');
        logger.info('Commodity: GOLD, SILVER, OIL');
        logger.info('Index: S&P 500, NASDAQ, USD Index');
        logger.info('');
        return;
    }

    if (specificContract) {
        const data = await fetchCOTData(forceRefresh);
        if (!data) {
            logger.error('❌ Failed to fetch COT data');
            process.exit(1);
        }
        const contract = data.contracts.find(c =>
            c.name.toLowerCase() === specificContract.toLowerCase()
        );
        if (!contract) {
            logger.error(`❌ Contract '${specificContract}' not found`);
            process.exit(1);
        }
        logger.info(`Contract: ${contract.name} (${contract.category})`);
        logger.info('────────────────────────────────────────');
        logger.info(`Sentiment: ${contract.sentiment}`);
        logger.info(`Speculator Net: ${contract.speculator.net.toLocaleString()}`);
        logger.info(`Speculator Long: ${contract.speculator.long.toLocaleString()}`);
        logger.info(`Speculator Short: ${contract.speculator.short.toLocaleString()}`);
        logger.info(`Commercial Net: ${contract.commercial.net.toLocaleString()}`);
        logger.info(`Commercial Long: ${contract.commercial.long.toLocaleString()}`);
        logger.info(`Commercial Short: ${contract.commercial.short.toLocaleString()}`);
        logger.info(`Open Interest: ${contract.openInterest.toLocaleString()}`);
        if (contract.marketBull) {
            logger.info('\n📈 MarketBull Data:');
            logger.info(`  COT Index (6M): ${contract.marketBull.cotIndex6M}`);
            logger.info(`  COT Index (36M): ${contract.marketBull.cotIndex36M}`);
            logger.info(`  Chart URL: ${contract.marketBull.chartUrl}`);
        }
        logger.info('');
        return;
    }

    // Full report
    const data = await fetchCOTData(forceRefresh);
    if (!data) {
        logger.error('❌ Failed to fetch COT data');
        process.exit(1);
    }

    if (format === 'json') {
        logger.info(JSON.stringify(data, null, 2));
        return;
    }

    // Text format
    logger.info('═══════════════════════════════════════════════════');
    logger.info('  COMMITMENT OF TRADERS (COT) REPORT');
    logger.info('═══════════════════════════════════════════════════');
    logger.info(`📅 Report Date: ${data.reportDate}`);
    logger.info(`🕐 Fetched At: ${new Date(data.fetchedAt).toLocaleString()}`);
    logger.info(`📈 Total Contracts: ${data.contracts.length}`);
    logger.info('');

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
            logger.info(`\n${cat.title}`);
            logger.info('─'.repeat(60));
            cat.items.forEach(item => logger.info(item));
        }
    });

    logger.info('\n═══════════════════════════════════════════════════');
    logger.info('Data Sources:');
    logger.info('  • Net Position: CFTC Local Mirror (cot_raw.txt)');
    logger.info('  • COT Index: MarketBull Mirror (marketbull_cot.json)');
    logger.info('═══════════════════════════════════════════════════\n');
}

main().catch(err => {
    logger.error('❌ Error:', err.message);
    process.exit(1);
});
