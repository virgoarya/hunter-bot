require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const CHANNEL_ID = "1475983790684766441";

// Sample breaking news data (realistic examples)
const SAMPLE_NEWS = [
  {
    title: "BREAKING: Fed Chair Powell signals pause in rate hikes, inflation cooling",
    source: "The Kobeissi Letter (Twitter)",
    link: "https://twitter.com/KobeissiLetter/status/123456",
    analysis: `**BREAKING NEWS ANALYSIS: Fed Signals Pause, Inflation Cooling**

📌 **Fakta:** Fed Chair Powell mengindikasikan kesempatan untuk jeda dalam siklus kenaikan suku bunga setelah data CPI terbaru menunjukkan inflasi mulai mereda ke level target 2%.

📊 **Dampak Market:**
- **Rates (US10Y):** Bearish (Yield Down) - Short-term.
- **Equities (S&P 500):** Bullish - Structural.
- **USD (DXY):** Bearish - Short-term.
- **Gold (XAU):** Bullish - Short-term.

🧠 **Logika:** Sinyal hawkishness yang lebih lemah → ekspektasi peak rate lebih rendah → tekanan longs dinero pada USD, relief rally pada saham & gold sebagai efek carry trade unwinding.

🔄 **Contrarian:** Pasar mungkin terlalu optimis. Laporan employment (NFP) minggu depan bisa mengubah narasi jika jobs growth tetap kuat. "Pause" tidak sama dengan "pivot" — Fed tetap hawkish secara komunikasi.

🔭 **Trigger:** Rilis NFP berikutnya (2 minggu), pertanyaan-pertanyaan di Kongres, dan pergerakan inflation breakevens di pasar Treasury.

⚖️ **Confidence:** High (75%) | ⏱️ **Timeframe:** Short-term (1-2 weeks)
⚠️ **Risk:** Data CPI mois berikutnya showing re-acceleration akan memicu re-pricing hawkish dan mengembalikan yield ke level lebih tinggi.`,
    timestamp: new Date().toISOString()
  },
  {
    title: "BREAKING: Iran seizes oil tanker in Strait of Hormuz, oil spikes 8%",
    source: "The Kobeissi Letter (Twitter)",
    link: "https://twitter.com/KobeissiLetter/status/789012",
    analysis: `**BREAKING NEWS ANALYSIS: Iran Tanker Seizure, Oil Supply Shock**

📌 **Fakta:** Iran menyatakan pengambilan kapal tanker asing di Selat Hormuz, memicu kenaikan harga minyak mentena AS sebesar 8% dalam 1 jam atas khawatir disruption pasokan global.

📊 **Dampak Market:**
- **Oil (WTI/Brent):** Bullish - Intraday (volatile).
- **Equities (Energy Sector):** Bullish - Short-term.
- **USD (DXY):** Bearish - Short-term (inflation import cost ↑).
- **Gold (XAU):** Bullish - Intraday (safe haven + inflation hedge).

🧠 **Logika:** Geopolitical tension di晋 bottleneck ochron → risk premium disorot pada物理 barrel → cost push inflation expectations → pressure pada central banks untuk tidak tightening lebih agresif, thus negative USD.

🔄 **Contrarian:** Market mungkin overreact jika insiden terisolir. Jika diplomasi segera mengubah situasi, harga minyak akan迅速 retrace 50% dari kenaikan. SPX energy stocks (XLE) akan terkoreksi bersamaan.

🔭 **Trigger:** Pernyataan White House/Pentagon, respons Saudi Arabia/AE, dan卫星 imagery showing military buildup di晋 Strait. Nasdaq volatility (VIX) > 25 akan memicu rebalancing porfolio away from risk assets.

⚖️ **Confidence:** Medium (60%) | ⏱️ **Timeframe:** Intraday to Short-term (2-5 days)
⚠️ **Risk:** De-eskalasi cepat (misal: release tanker dalam 24-48 jam) akan memicu short-covering panic di kopro & energy equities, UITU result in sharp correction.`,
    timestamp: new Date().toISOString()
  },
  {
    title: "BREAKING: China property giant Evergrande liquidated, contagion risk rises",
    source: "The Kobeissi Letter (Twitter)",
    link: "https://twitter.com/KobeissiLetter/status/345678",
    analysis: `**BREAKING NEWS ANALYSIS: Evergrande Liquidation, China Property Contagion**

📌 **Fakta:** Pengadilan Cina mengumumkan likuidasi强制 para discuss为中国房地产 giant Evergrande Group setelah gagal mencapai kesepakatan restructuring dengan kreditur, memicu ketakutan akan kontagio sektor properti.

📊 **Dampak Market:**
- **Equities (China A-shares/H-shares):** Bearish - Short-term (panic selling).
- ** Commodities (Copper, Iron Ore):** Bearish - Short-term (China demand destruction).
- **AUD/USD:** Bearish - Short-term (China exposure).
- **Safe Havens (USD, CHF, JPY):** Bullish - Intraday.

🧠 **Logika:** Default developer terbesar Cina → systemic risk perception di晋 property sector → potential bank exposure (NPLs) → credit crunch fears → capital flight dari晋 Renminbi assets → RMB depreciation pressure.

🔄 **Contrarian:** Pemerintah Cina mungkin mengeluarkan stimulus besar-scale untuk contain panic. If PBOC cuts RRR aggressively & fiscal stimulus announced, dip-an could be short-lived (1-2 days). Big 4 state-owned developers may be seen as "too big to fail" and outperform.

🔭 **Trigger:** Rilis data credit growth Cina (lending), aksi regulator (CBRC, PBOC), dan pergerakan CDS spreads on China sovereign debt. Tencent (700.HK) price action as barometer of Hong Kong market sentiment.

⚖️ **Confidence:** Medium (55%) | ⏱️ **Timeframe:** Short-term to Medium (1-4 weeks)
⚠️ **Risk:** If this triggers a wave of defaults across China property (~20% of GDP exposure), global risk-off could be severe, affecting all EM assets and commodities. Monitor USDCNY fixing for intervention signals.`,
    timestamp: new Date().toISOString()
  }
];

async function broadcastSampleNews() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  try {
    console.log('🔌 Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected as', client.user.tag);

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) throw new Error(`Channel ${CHANNEL_ID} not found`);
    console.log(`📺 Channel: ${channel.name} (${CHANNEL_ID})\n`);

    console.log('📊 Available sample news:');
    SAMPLE_NEWS.forEach((s, i) => {
      console.log(`\n[${i + 1}] ${s.title}`);
      console.log(`    Source: ${s.source}`);
      console.log(`    Analysis length: ${s.analysis.length} chars`);
    });

    console.log('\n━'.repeat(60));
    console.log('🎯 Broadcasting sample news to Discord...\n');

    // Broadcast all samples (with delay)
    for (let i = 0; i < SAMPLE_NEWS.length; i++) {
      const sample = SAMPLE_NEWS[i];

      let description = sample.analysis;
      if (description.length > 4000) {
        description = description.substring(0, 3997) + "...";
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎯 BREAKING MACRO ANALYSIS (SAMPLE ${i + 1}/${SAMPLE_NEWS.length})`)
        .setColor("#e74c3c")
        .setDescription(description)
        .addFields(
          { name: "📰 Headline", value: sample.title.substring(0, 256), inline: false },
          { name: "📰 Source", value: sample.source, inline: true },
          { name: "🔗 Link", value: sample.link ? `[Baca](${sample.link})` : "N/A", inline: true },
          { name: "🕒 Timestamp", value: new Date(sample.timestamp).toLocaleString("id-ID"), inline: false },
          { name: "⚠️ Disclaimer", value: "Analisis ini bersifat edukasional dan bukan rekomendasi investasi. Confidence score disarankan sebagai reference, bukan kepastian. Always do your own research (DYOR).", inline: false }
        )
        .setTimestamp()
        .setFooter({ text: "Critical Thinking Macro Desk | SAMPLE DATA | Hunter Bot" });

      await channel.send({ embeds: [embed] });
      console.log(`✅ Broadcasted sample ${i + 1}: ${sample.title.substring(0, 50)}...`);

      // Delay between broadcasts
      if (i < SAMPLE_NEWS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('\n✅ All sample news broadcasted successfully!');
    console.log('\n💡 Check the Discord channel to review the embed formatting and content.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('token')) {
      console.log('\n🔧 Make sure DISCORD_TOKEN is set in .env file');
    }
  } finally {
    await client.destroy();
    console.log('🔌 Disconnected');
  }
}

broadcastSampleNews();
