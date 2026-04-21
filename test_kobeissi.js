require('dotenv').config();
const { fetchAndAnalyzeMacroNews } = require('./services/macroNewsAnalyzer');

console.log('🧪 Testing KobeissiLetter (Twitter) Source\n');
console.log('━'.repeat(60));

fetchAndAnalyzeMacroNews()
  .then(analyses => {
    console.log('\n📊 RESULTS:');
    console.log('Total analyses:', analyses.length);

    if (analyses.length > 0) {
      analyses.forEach((a, i) => {
        console.log(`\n[${i + 1}] Source: ${a.source}`);
        console.log(`    Title: ${a.title.substring(0, 80)}...`);
        console.log(`    Analysis length: ${a.analysis.length} chars`);
        console.log(`    Analysis preview: ${a.analysis.substring(0, 200)}...`);
      });
    } else {
      console.log('❌ No analyses returned from any source');
    }
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
