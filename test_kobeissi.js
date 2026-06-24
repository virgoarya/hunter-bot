const logger = require('../utils/logger');
require('dotenv').config();
const { fetchAndAnalyzeMacroNews } = require('./services/macroNewsAnalyzer');

logger.info('🧪 Testing KobeissiLetter (Twitter) Source\n');
logger.info('━'.repeat(60));

fetchAndAnalyzeMacroNews()
  .then(analyses => {
    logger.info('\n📊 RESULTS:');
    logger.info('Total analyses:', analyses.length);

    if (analyses.length > 0) {
      analyses.forEach((a, i) => {
        logger.info(`\n[${i + 1}] Source: ${a.source}`);
        logger.info(`    Title: ${a.title.substring(0, 80)}...`);
        logger.info(`    Analysis length: ${a.analysis.length} chars`);
        logger.info(`    Analysis preview: ${a.analysis.substring(0, 200)}...`);
      });
    } else {
      logger.info('❌ No analyses returned from any source');
    }
  })
  .catch(err => {
    logger.error('\n❌ Error:', err.message);
    process.exit(1);
  });
