const { fetchLatestTweets } = require("./services/twitterService");
require("dotenv").config();

async function testTwitter() {
    console.log("--- TESTING TWITTER FEED & TRANSLATION ---");
    
    // First run - will initialize cache
    console.log("\nRunning first fetch (Initialization)...");
    const init = await fetchLatestTweets();
    console.log(`Initial fetch returned ${init.length} tweets (Expected 0 if cache was empty).`);

    // Manually clear cache lastTweetId to force a "new" tweet for testing if needed
    // but better to just see it work.
    
    console.log("\nRunning second fetch (Checking for 'new' tweets)...");
    // For testing purposes, we might want to manually modify the cache 
    // to see it pick up the "latest" as new if we delete the cache file.
    
    const tweets = await fetchLatestTweets();
    if (tweets.length > 0) {
        console.log(`✅ Success! Found \${tweets.length} new tweets.`);
        tweets.forEach((t, i) => {
            console.log(`\n[Tweet ${i+1}]`);
            console.log(`Original: ${t.content.substring(0, 100)}...`);
            console.log(`Translated: ${t.translatedContent.substring(0, 100)}...`);
        });
    } else {
        console.log("ℹ️ No new tweets found (Cache is up to date).");
    }
}

testTwitter();
