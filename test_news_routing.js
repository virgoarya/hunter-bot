require('dotenv').config();
const { broadcastMacroNewsAnalysis } = require('./services/macroNewsAnalyzer');

console.log('Testing Macro News Analyzer Channel Routing...');
console.log('ALERT_CHANNEL_ID from .env:', process.env.ALERT_CHANNEL_ID);

// We won't actually broadcast if we don't have a valid bot token or news, 
// but we can check if the internal CHANNEL_ID in the service is correct.
const macroNewsAnalyzer = require('./services/macroNewsAnalyzer');
// Since CHANNEL_ID is private in the module, we'd need to expose it or trust the code change.
// But I can check if the file content is correct.
