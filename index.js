// Set timezone to WIB (UTC+7) for the entire application
process.env.TZ = 'Asia/Jakarta';

require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// === Services ===
const { generateReply } = require("./services/aiResponder");
const { addMessage } = require("./services/conversationMemory");
const { sendMacroUpdate } = require("./bot/sendMacroUpdate");
const { startAllSchedulers } = require("./utils/macroScheduler");
const { sendOutlookBroadcast } = require("./services/outlookBroadcast");
const { buildCalendarBroadcast, getHighImpactAlerts, getNewReleaseAlerts } = require("./services/calendarBroadcast");
const { fetchLiquidityFlow, formatFlowSummary } = require("./services/liquidityFlow");
const { fetchCOTData, formatCOTReport } = require("./services/cotData");
const { fetchMultiPrice, formatPriceTable } = require("./services/marketPrice");
const { sendTwitterUpdate } = require("./bot/sendTwitterUpdate");
const { sendReutersUpdate } = require("./bot/sendReutersUpdate"); // New
const { broadcastMacroNewsAnalysis } = require("./services/macroNewsAnalyzer"); // New: Macro news critical thinking

// === Utility: Split long messages ===
function splitMessage(text, maxLength = 2000) {
  const chunks = [];
  let currentChunk = "";

  const lines = text.split("\n");
  for (const line of lines) {
    if ((currentChunk + line).length + 1 > maxLength) {
      chunks.push(currentChunk);
      currentChunk = line + "\n";
    } else {
      currentChunk += line + "\n";
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// === Send multi-chunk message ===
async function sendLongMessage(channel, text) {
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    if (chunk.trim()) {
      await channel.send(chunk);
    }
  }
}

// === Register Slash Commands ===
async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("outlook")
      .setDescription("📊 Dapatkan outlook pasar terkini")
      .addStringOption(option =>
        option.setName("type")
          .setDescription("Tipe outlook")
          .setRequired(false)
          .addChoices(
            { name: "Morning", value: "morning" },
            { name: "London Session", value: "london" },
            { name: "New York Session", value: "newyork" },
          )
      ),
    new SlashCommandBuilder()
      .setName("cot")
      .setDescription("📊 Lihat data Commitment of Traders terbaru"),
    new SlashCommandBuilder()
      .setName("flow")
      .setDescription("💧 Lihat liquidity flow real-time"),
    new SlashCommandBuilder()
      .setName("calendar")
      .setDescription("📅 Lihat economic calendar hari ini"),
    new SlashCommandBuilder()
      .setName("price")
      .setDescription("💰 Lihat harga pasar real-time"),
  ].map(cmd => cmd.toJSON());

  try {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Slash commands registered");
  } catch (error) {
    console.error("❌ Slash command registration error:", error.message);
  }
}

// === Bot Ready ===
client.once(Events.ClientReady, async () => {
  console.log(`\n✅ Hunter Bot v2.1 (Adaptive) logged in as ${client.user.tag}`);
  console.log(`🤖 AI Model: ${process.env.OPENROUTER_MODEL}`);
  console.log(`📡 Channels: AI=${process.env.AI_CHANNEL_ID} | Macro=${process.env.MACRO_CHANNEL_ID}\n`);

  // Register slash commands
  await registerSlashCommands();

  // Start all scheduled broadcasts
  startAllSchedulers({
    // Morning Outlook (06:00 WIB Mon-Fri)
    morningOutlook: async () => {
      await sendOutlookBroadcast(client, "morning");
    },

    // Calendar Daily (06:15 WIB Mon-Fri)
    calendarDaily: async () => {
      const payload = await buildCalendarBroadcast();
      if (payload) {
        const channel = await client.channels.fetch(process.env.MACRO_CHANNEL_ID);
        if (channel) await channel.send(payload);
      }
    },

    // London Session (14:00 WIB Mon-Fri)
    londonSession: async () => {
      await sendOutlookBroadcast(client, "london");
    },

    // NY Session (20:00 WIB Mon-Fri)
    nySession: async () => {
      await sendOutlookBroadcast(client, "newyork");
    },

    // Macro Update (Every 4 hours)
    macroUpdate: async (silent = false) => {
      await sendMacroUpdate(client, silent);
    },

    // COT Weekly (08:00 WIB Saturday)
    cotWeekly: async () => {
      await sendOutlookBroadcast(client, "cot");
    },

    // High Impact Event Alert (Every 15 minutes)
    eventAlert: async () => {
      const alerts = await getHighImpactAlerts();
      if (alerts.length > 0) {
        const channel = await client.channels.fetch(process.env.MACRO_CHANNEL_ID);
        if (channel) {
          for (const alert of alerts) {
            // alert is already an object with { embeds: [...] } from getHighImpactAlerts()
            // Just send it directly
            await channel.send({ embeds: alert.embeds });
          }
        }
      }
    },

    // New Data Release Alert (Every 5 minutes)
    releaseAlert: async () => {
      const alerts = await getNewReleaseAlerts();
      if (alerts && alerts.length > 0) {
        const channel = await client.channels.fetch(process.env.MACRO_CHANNEL_ID);
        if (channel) {
          for (const alert of alerts) {
            await channel.send(alert);
          }
        }
      }
    },

    // Twitter Updates (Every 10 minutes)
    twitterUpdates: async () => {
      await sendTwitterUpdate(client);
    },

    // Reuters Updates (Every 30 minutes)
    reutersUpdates: async () => {
      await sendReutersUpdate(client);
    },

    // Macro News Analysis with Critical Thinking (Every 15 minutes)
    macroNewsAnalysis: async () => {
      await broadcastMacroNewsAnalysis();
    },
  });
});

// === Slash Command Handler ===
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply();

  try {
    switch (interaction.commandName) {
      case "outlook": {
        const type = interaction.options.getString("type") || "morning";
        let payload;
        if (type === "morning") {
          const { buildMorningOutlook } = require("./services/outlookBroadcast");
          payload = await buildMorningOutlook();
        } else if (type === "london") {
          const { buildSessionOutlook } = require("./services/outlookBroadcast");
          payload = await buildSessionOutlook("London");
        } else {
          const { buildSessionOutlook } = require("./services/outlookBroadcast");
          payload = await buildSessionOutlook("New York");
        }
        await interaction.editReply(payload || "Data outlook tidak tersedia.");
        break;
      }

      case "cot": {
        const { buildCOTBroadcast } = require("./services/outlookBroadcast");
        const payload = await buildCOTBroadcast();
        await interaction.editReply(payload || "Data COT tidak tersedia.");
        break;
      }

      case "flow": {
        const { buildFlowEmbed } = require("./services/liquidityFlow");
        const flowData = await fetchLiquidityFlow();
        const payload = buildFlowEmbed(flowData);
        await interaction.editReply(payload || "Data flow tidak tersedia.");
        break;
      }

      case "calendar": {
        const payload = await buildCalendarBroadcast();
        await interaction.editReply(payload || "Tidak ada event calendar hari ini.");
        break;
      }

      case "price": {
        const prices = await fetchMultiPrice();
        const msg = formatPriceTable(prices);
        await interaction.editReply(msg || "Harga pasar tidak tersedia.");
        break;
      }

      default:
        await interaction.editReply("Command tidak dikenal.");
    }
  } catch (error) {
    console.error("Slash command error:", error);
    await interaction.editReply("⚠️ Terjadi kesalahan saat memproses command.");
  }
});

// === Message Handler (AI Responder) ===
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== process.env.AI_CHANNEL_ID) return;

  const question = message.content;
  const userId = message.author.id;

  console.log(`💬 [${message.author.username}]: ${question}`);

  try {
    // Show typing indicator
    await message.channel.sendTyping();

    // Store user message in conversation memory
    addMessage(userId, "user", question);

    // Generate AI reply with user context
    const reply = await generateReply(question, userId);

    // Store bot reply in conversation memory
    addMessage(userId, "assistant", reply);

    // Split reply if too long for Discord (2000 char limit)
    const chunks = splitMessage(reply);

    for (const chunk of chunks) {
      if (chunk.trim()) {
        await message.reply(chunk);
      }
    }
  } catch (error) {
    console.error("Error handling message:", error);
    await message.reply("⚠️ Terjadi kesalahan saat memproses permintaan Anda.");
  }
});

// === Health Check Server (For Railway/Heroku) ===
const http = require("http");
const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Hunter Bot is running\n");
});

server.listen(PORT, () => {
  console.log(`📡 Health check server listening on port ${PORT}`);
});

// === Error Handling & Graceful Shutdown ===
client.on("error", (error) => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  // Optional: Graceful exit after critical exception
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close();
  client.destroy();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  server.close();
  client.destroy();
  process.exit(0);
});

// === Login ===
client.login(process.env.DISCORD_TOKEN);
