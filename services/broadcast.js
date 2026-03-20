const { EmbedBuilder } = require("discord.js");

async function sendBiasBroadcast(client, channelId, regime, bias, session, shift, intent, narrative) {
  const channel = await client.channels.fetch(channelId);
  if (!channel) return;

  // Determine Embed Color based on Regime or Intent
  let embedColor = "#3498db"; // Default Blue
  const lowerRegime = regime.regime ? regime.regime.toLowerCase() : "";
  const lowerIntent = intent.intent ? intent.intent.toLowerCase() : "";

  if (lowerRegime.includes("panik") || lowerIntent.includes("de-risking") || lowerIntent.includes("distribusi")) {
    embedColor = "#e74c3c"; // Merah (Bahaya/Exit)
  } else if (lowerRegime.includes("reflasi") || lowerRegime.includes("goldilocks") || lowerIntent.includes("ekspansi") || lowerIntent.includes("akumulasi")) {
    embedColor = "#2ecc71"; // Hijau (Pertumbuhan/Entry)
  } else if (lowerRegime.includes("defensif") || lowerRegime.includes("tekanan") || lowerRegime.includes("stagflasi")) {
    embedColor = "#e67e22"; // Oranye (Waspada)
  } else if (lowerRegime.includes("transisi") || lowerIntent.includes("tunggu")) {
    embedColor = "#3498db"; // Biru (Netral)
  }

  const title = shift ? "🚨 PERUBAHAN REZIM INSTITUSIONAL" : "📊 PEMBARUAN MAKRO";

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(embedColor)
    .setDescription(`**Narasi:**\n${narrative}`)
    .addFields(
      { name: "📊 Rezim Makro", value: `**${regime.regime || "N/A"}**\n*${regime.description || ""}*`, inline: true },
      { name: "🧠 Niat Pasar (Intent)", value: `**${intent.intent || "N/A"}**\n*${intent.description || ""}*`, inline: true }
    )
    .addFields({ name: "\u200B", value: "\u200B" }) // Spacer
    .addFields(
      { name: "💵 Bias USD", value: bias.usdBias || "Netral", inline: true },
      { name: "🥇 Bias Emas", value: bias.goldBias || "Netral", inline: true },
      { name: "📉 Bias Saham", value: bias.equityBias || "Netral", inline: true }
    )
    .addFields({ name: "\u200B", value: "\u200B" }) // Spacer
    .addFields(
      { name: "🌍 Outlook London", value: session.londonBias || "N/A", inline: false },
      { name: "🇺🇸 Outlook New York", value: session.newyorkBias || "N/A", inline: false }
    )
    .setTimestamp()
    .setFooter({ text: "Hunter Bot • Intelijen Institusional" });

  if (shift) {
    embed.addFields(
      { name: "⚠️ Terdeteksi Perubahan Rezim", value: `Dari **${shift.from}** ➔ Menjadi **${shift.to}**`, inline: false }
    );
  }

  await channel.send({ embeds: [embed] });
}

module.exports = { sendBiasBroadcast };