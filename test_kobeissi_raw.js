const logger = require('../utils/logger');
require('dotenv').config();
const { fetchLatestTweets } = require('./services/twitterService');

logger.info('📰 Fetching raw tweets from @KobeissiLetter\n');
logger.info('━'.repeat(60));

fetchLatestTweets()
  .then(tweets => {
    logger.info('\n📊 RAW TWEETS FETCHED:', tweets.length);
    logger.info('━'.repeat(60));

    if (tweets.length === 0) {
      logger.info('❌ No new tweets found (cache hit or no new tweets)');
      return;
    }

    tweets.forEach((t, i) => {
      logger.info(`\n[${i + 1}] ${t.date || 'No date'}`);
      logger.info(`Content: ${t.content.substring(0, 150)}${t.content.length > 150 ? '...' : ''}`);
      logger.info(`Link: ${t.link || 'N/A'}`);
    });

    logger.info('\n━'.repeat(60));
    logger.info('💡 To see which ones pass breaking news filter, run:');
    logger.info('   node -e "require(\'dotenv\').config(); const { isBreakingNews } = require(\'./services/macroNewsAnalyzer\'); const tweets = require(\'./twitter_cache.json\') || []; logger.info(tweets.filter(t => isBreakingNews(t.content, t.content)).length, \'breaking news\')"');
  })
  .catch(err => {
    logger.error('\n❌ Error:', err.message);
    process.exit(1);
  });
