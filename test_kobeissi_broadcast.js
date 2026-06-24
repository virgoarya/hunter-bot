const logger = require('../utils/logger');
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { fetchLatestTweets } = require('./services/twitterService');
const { isBreakingNews } = require('./services/macroNewsAnalyzer');
const { postToAI } = require('./utils/aiProxy');

const CHANNEL_ID = "1475983790684766441";

async function analyzeTweetWithAI(tweet) {
  const prompt = `
## CRITICAL THINKING FRAMEWORK: MACRO NEWS IMPACT ANALYSIS

You are a senior macro analyst at an institutional trading desk. Analyze the following breaking news through multiple lenses.

=== NEWS ===
Source: KobeissiLetter (Twitter)
Title: ${tweet.content}
Context: ${tweet.content}

=== ANALYSIS FRAMEWORK ===

1. **WHAT HAPPENED?** (Objective facts only - 1 sentence)

2. **MARKET IMPACT ASSESSMENT:**
   - Which asset classes will be affected? (Currencies, Rates, Equities, Commodities, Volatility)
   - Direction of impact: Bullish / Bearish / Neutral for each
   - Timeframe: Intraday / Short-term (1-5 days) / Structural (>1 week)

3. **MARKET REASONING (Chain of Cause-Effect):**
   Explain the logical chain: "[Event] → [Mechanism] → [Market Reaction]"

4. **CONTRARIAN VIEW / SECOND-ORDER EFFECTS:**
   - What if the market overreacts?
   - What are the unintended consequences?
   - Is this already priced in?

5. **KEY TRIGGERS TO WATCH:**
   - What data/events will confirm or invert this thesis?

6. **CONFIDENCE & TIMEFRAME:**
   - Confidence: High (>75%) / Medium (50-75%) / Low (<50%)
   - Primary timeframe for this impact
   - Risk: What would make this analysis wrong?

=== OUTPUT FORMAT (Bahasa Indonesia, Institutional Tone) ===

**BREAKING NEWS ANALYSIS: [Summarize title]**

📌 **Fakta:** [1 sentence objective summary]

📊 **Dampak Market:**
- [Asset]: [Bullish/Bearish/Neutral] - [Timeframe]
- [Asset]: ...

🧠 **Logika:** [Cause-effect chain in 2-3 sentences]

🔄 **Contrarian:** [Second-order effects / overreaction scenarios]

🔭 **Trigger:** [What to watch next]

⚖️ **Confidence:** [High/Med/Low] | ⏱️ **Timeframe:** [Intraday/Short-term/Structural]
⚠️ **Risk:** [Invalidation condition]

Keep it concise (max 20 lines). Use professional Indonesian.`;

  try {
    const response = await postToAI([
      { role: "system", content: "Kamu adalah Chief Macro Strategist di sebuah hedge fund institusi. Berikan analisis dengan penilaian kritis." },
      { role: "user", content: prompt }
    ], { temperature: 0.4, max_tokens: 1500, timeout: 30000 });

    return response?.trim() || null;
  } catch (error) {
    logger.error('AI analysis error:', error.message);
    return null;
  }
}

async function testKobeissiLetterBroadcast() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  try {
    logger.info('🔌 Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    logger.info('✅ Connected as', client.user.tag);

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) throw new Error(`Channel ${CHANNEL_ID} not found`);
    logger.info(`📺 Channel: ${channel.name}`);

    logger.info('\n📡 Fetching tweets from @KobeissiLetter...');
    const tweets = await fetchLatestTweets();

    if (tweets.length === 0) {
      logger.info('⚠️ No new tweets from KobeissiLetter (cache hit or no new tweets)');
      await client.destroy();
      return;
    }

    logger.info(`✅ Fetched ${tweets.length} tweets`);

    // Filter breaking news
    const breakingTweets = tweets.filter(t => isBreakingNews(t.content, t.content));
    logger.info(`🎯 Breaking news found: ${breakingTweets.length}`);

    if (breakingTweets.length === 0) {
      logger.info('❌ No tweets passed breaking news filter');
      logger.info('\n📋 All tweets (for debugging):');
      tweets.forEach((t, i) => {
        const isBreaking = isBreakingNews(t.content, t.content);
        logger.info(`\n[${i+1}] ${isBreaking ? '✅' : '❌'} ${t.date || 'No date'}`);
        logger.info(`   ${t.content.substring(0, 100)}...`);
      });
      await client.destroy();
      return;
    }

    // Take top 1 (newest based on sort)
    breakingTweets.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const selected = breakingTweets[0];

    logger.info(`\n🏆 Selected tweet:`);
    logger.info(`Date: ${selected.date}`);
    logger.info(`Content: ${selected.content.substring(0, 150)}...`);
    logger.info(`Link: ${selected.link}`);

    logger.info('\n🤖 Analyzing with AI...');
    const analysis = await analyzeTweetWithAI(selected);

    if (!analysis) {
      logger.error('❌ AI analysis failed');
      await client.destroy();
      return;
    }

    logger.info(`✅ Analysis complete (${analysis.length} chars)`);

    // Send to Discord
    let description = analysis;
    if (description.length > 4000) {
      description = description.substring(0, 3997) + "...";
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎯 BREAKING MACRO ANALYSIS`)
      .setColor("#e74c3c")
      .setDescription(description)
      .addFields(
        { name: "📰 Headline", value: selected.content.substring(0, 256), inline: false },
        { name: "📰 Source", value: "The Kobeissi Letter (Twitter)", inline: true },
        { name: "🔗 Link", value: selected.link ? `[Baca](${selected.link})` : "N/A", inline: true },
        { name: "🕒 Timestamp", value: new Date().toLocaleString("id-ID"), inline: false }
      )
      .setTimestamp()
      .setFooter({ text: "Critical Thinking Macro Desk | Hunter Bot" });

    await channel.send({ embeds: [embed] });
    logger.info('\n✅ Broadcasted to Discord channel!');

  } catch (error) {
    logger.error('\n❌ Error:', error.message);
  } finally {
    await client.destroy();
    logger.info('🔌 Disconnected');
  }
}

testKobeissiLetterBroadcast();
