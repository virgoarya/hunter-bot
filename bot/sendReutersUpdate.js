const { EmbedBuilder } = require("discord.js");
const { fetchReutersFinance } = require("../services/reutersService");

async function sendReutersUpdate(client) {
    try {
        const REUTERS_CHANNEL_ID = "1475983855042302123";
        const channel = await client.channels.fetch(REUTERS_CHANNEL_ID);
        
        if (!channel) {
            console.error("❌ Reuters channel not found:", REUTERS_CHANNEL_ID);
            return;
        }

        const newArticles = await fetchReutersFinance();

        if (newArticles.length === 0) {
            console.log("ℹ️ No new Reuters articles to broadcast.");
            return;
        }

        for (const article of newArticles) {
            const embed = new EmbedBuilder()
                .setTitle("📰 HEADLINE REUTERS FINANCE")
                .setAuthor({ name: "Reuters Business Finance", url: "https://www.reuters.com/business/finance/" })
                .setDescription(article.expandedContent || article.translatedTitle || article.title)
                .setColor("#FF8C00") // Reuters Orange-ish
                .addFields(
                    { name: "Original Source", value: `[Read on Reuters](${article.link})`, inline: true }
                )
                .setFooter({ text: "Translated to Indonesia by Hunter AI" })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            console.log("📡 Broadcasted Reuters headline:", article.title.substring(0, 30));
        }

    } catch (error) {
        console.error("❌ Error in sendReutersUpdate:", error);
    }
}

module.exports = { sendReutersUpdate };
