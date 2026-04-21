require('dotenv').config();
const { fetchLatestTweets } = require('./services/twitterService');

console.log('📰 Fetching raw tweets from @KobeissiLetter\n');
console.log('━'.repeat(60));

fetchLatestTweets()
  .then(tweets => {
    console.log('\n📊 RAW TWEETS FETCHED:', tweets.length);
    console.log('━'.repeat(60));

    if (tweets.length === 0) {
      console.log('❌ No new tweets found (cache hit or no new tweets)');
      return;
    }

    tweets.forEach((t, i) => {
      console.log(`\n[${i + 1}] ${t.date || 'No date'}`);
      console.log(`Content: ${t.content.substring(0, 150)}${t.content.length > 150 ? '...' : ''}`);
      console.log(`Link: ${t.link || 'N/A'}`);
    });

    console.log('\n━'.repeat(60));
    console.log('💡 To see which ones pass breaking news filter, run:');
    console.log('   node -e "require(\'dotenv\').config(); const { isBreakingNews } = require(\'./services/macroNewsAnalyzer\'); const tweets = require(\'./twitter_cache.json\') || []; console.log(tweets.filter(t => isBreakingNews(t.content, t.content)).length, \'breaking news\')"');
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
