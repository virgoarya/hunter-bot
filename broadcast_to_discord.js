const logger = require("../utils/logger");
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { fetchAndAnalyzeMacroNews } = require('./services/macroNewsAnalyzer');

const CHANNEL_ID = "1475983790684766441"; // Target channel

async function broadcastMacroAnalysis() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  try {
    logger.info('🔌 Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    logger.info('✅ Connected as', client.user.tag);

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      throw new Error(`Channel ${CHANNEL_ID} not found or bot has no access`);
    }
    logger.info(`📺 Found channel: ${channel.name} (${CHANNEL_ID})`);

    logger.info('\n📡 Fetching and analyzing macro news...');
    const analyses = await fetchAndAnalyzeMacroNews();

    if (analyses.length === 0) {
      logger.info('⚠️ No breaking news to broadcast');
      await client.destroy();
      return;
    }

    logger.info(`✅ Got ${analyses.length} analysis to broadcast`);

    for (const analysis of analyses) {
      let description = analysis.analysis || "*Analisis tidak tersedia*";
      if (description.length > 4000) {
        description = description.substring(0, 3997) + "...";
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎯 BREAKING MACRO ANALYSIS`)
        .setColor("#e74c3c")
        .setDescription(description)
        .addFields(
          { name: "📰 Headline", value: analysis.title.substring(0, 256), inline: false },
          { name: "📰 Source", value: analysis.source, inline: true },
          { name: "🔗 Link", value: analysis.link ? `[Baca](${analysis.link})` : "N/A", inline: true },
          { name: "🕒 Timestamp", value: new Date(analysis.timestamp).toLocaleString("id-ID"), inline: false }
        )
        .setTimestamp()
        .setFooter({ text: "Critical Thinking Macro Desk | Hunter Bot" });

      try {
        await channel.send({ embeds: [embed] });
        logger.info(`📤 Broadcasted: ${analysis.title.substring(0, 50)}...`);
      } catch (discordErr) {
        logger.error('❌ Failed to send embed:', discordErr.message);
        // Fallback to plain text
        await channel.send(`**BREAKING MACRO ANALYSIS**\n\n${analysis.analysis}\n\nSource: ${analysis.source}\nLink: ${analysis.link || 'N/A'}`);
        logger.info('📤 Broadcasted as plain text fallback');
      }

      // Delay between multiple broadcasts
      if (analyses.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info('\n✅ Broadcast completed!');

  } catch (error) {
    logger.error('\n❌ Error:', error.message);
    if (error.message.includes('token')) {
      logger.info('\n💡 Make sure DISCORD_TOKEN is set in .env file');
    }
  } finally {
    await client.destroy();
    logger.info('🔌 Disconnected');
  }
}

broadcastMacroAnalysis();
