const { EmbedBuilder } = require("discord.js");
const { fetchLatestTweets } = require("../services/twitterService");

const TWITTER_CHANNEL_ID = "1475983855042302123";

async function sendTwitterUpdate(client) {
    try {
        const newTweets = await fetchLatestTweets();
        
        if (!newTweets || newTweets.length === 0) {
            console.log("📭 No new tweets from @KobeissiLetter.");
            return;
        }

        const channel = await client.channels.fetch(TWITTER_CHANNEL_ID);
        if (!channel) {
            console.error("❌ Twitter broadcast channel not found:", TWITTER_CHANNEL_ID);
            return;
        }

        for (const tweet of newTweets) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: "The Kobeissi Letter (@KobeissiLetter)", 
                    iconURL: "https://unavatar.io/twitter/KobeissiLetter",
                    url: "https://x.com/KobeissiLetter"
                })
                .setTitle("🚨 NEW MACRO FEED")
                .setDescription(tweet.translatedContent || tweet.content)
                .setColor("#1DA1F2")
                .addFields(
                    { name: "Original Post", value: `[Link to Tweet](${tweet.link})`, inline: true }
                )
                .setFooter({ text: "Translated to Indonesia by Hunter AI" })
                .setTimestamp(new Date(tweet.date));

            await channel.send({ embeds: [embed] });
            console.log("📡 Broadcasted tweet:", tweet.id);
        }
    } catch (error) {
        console.error("Error in sendTwitterUpdate:", error.message);
    }
}

module.exports = { sendTwitterUpdate };
