// Set timezone to WIB (UTC+7) for the entire application
process.env.TZ = 'Asia/Jakarta';

require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events } = require("discord.js");
const logger = require('./utils/logger');

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
    logger.info("✅ Slash commands registered");
  } catch (error) {
    logger.error("❌ Slash command registration error:", { error: error.message });
  }
}

// === Bot Ready ===
client.once(Events.ClientReady, async () => {
  logger.info(`\n✅ Hunter Bot v2.1 (Adaptive) logged in as ${client.user.tag}`);
  logger.info(`🤖 AI Model: ${process.env.OPENROUTER_MODEL}`);
  logger.info(`📡 Channels: AI=${process.env.AI_CHANNEL_ID} | Macro=${process.env.MACRO_CHANNEL_ID}\n`);

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

    /*
    // Twitter Updates (Every 10 minutes)
    twitterUpdates: async () => {
      await sendTwitterUpdate(client);
    },

    // Reuters Updates (Every 30 minutes)
    reutersUpdates: async () => {
      await sendReutersUpdate(client);
    },
    */

    // Macro News Analysis with Critical Thinking (Every 2 hours)
    macroNewsAnalysis: async () => {
      await broadcastMacroNewsAnalysis(client);
    },
  });
});

// === Slash Command Handler ===
client.on("interactionCreate", async (interaction) => {
  // Guard against non‑chat commands or already‑handled interactions
  if (!interaction.isChatInputCommand()) return;
  if (interaction.replied) {
    logger.warn('Interaction already replied', { interactionId: interaction.id });
    return;
  }
  // Defer reply safely – ignore Unknown interaction (10062)
  if (!interaction.deferred) {
    try {
      await interaction.deferReply();
    } catch (e) {
      // If the interaction has already been responded to or is invalid, Discord returns code 10062.
      if (e?.code === 10062) {
        logger.warn('Unknown interaction on deferReply, likely already handled', { interactionId: interaction.id });
        // Continue without deferring; we may still send a follow‑up later.
      } else {
        logger.error('Failed to defer reply', { error: e });
        throw e;
      }
    }
  }


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
    logger.error("Slash command error:", error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: "⚠️ Terjadi kesalahan saat memproses command." });
      } else {
        await interaction.reply({ content: "⚠️ Terjadi kesalahan saat memproses command." });
      }
    } catch (e) {
      logger.error("Failed to send error reply:", e);
    }
  }
});

// === Message Handler (AI Responder) ===
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== process.env.AI_CHANNEL_ID) return;

  const question = message.content;
  const userId = message.author.id;

  logger.info(`💬 [${message.author.username}]: ${question}`);

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
    logger.error("Error handling message:", error);
    await message.reply("⚠️ Terjadi kesalahan saat memproses permintaan Anda.");
  }
});

// === REST API Server (Health Check + Dashboard Data) ===
const http = require("http");
const { getMacroState } = require("./services/macroData");
const { classifyRegime } = require("./services/regime");
const { buildBias } = require("./services/biasEngine");
const { getSeasonalTendency } = require("./services/seasonality");
const PORT = process.env.PORT || 8080;

function jsonResponse(res, data) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const url = req.url;

  // Health check
  if (url === "/" || url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Hunter Bot is running\n");
  }

  // === API: Full dashboard data (macro + regime + bias + seasonality) ===
  if (url === "/api/dashboard") {
    try {
      const macro = getMacroState();
      const regime = macro?.isHealthy ? classifyRegime(macro) : { regime: "Loading...", description: "Menunggu data makro..." };
      const bias = macro?.isHealthy ? buildBias(macro, regime) : { usdBias: "N/A", goldBias: "N/A", equityBias: "N/A", oilBias: "N/A" };
      const seasonal = getSeasonalTendency();

      return jsonResponse(res, {
        regime: regime,
        bias: bias,
        seasonality: seasonal,
        macro: macro?.isHealthy ? {
          DXY: macro.DXY,
          US10Y: macro.US10Y,
          VIX: macro.VIX,
          GOLD: macro.GOLD,
          NASDAQ: macro.NASDAQ,
          OIL: macro.OIL,
          RealYield: macro.RealYield,
          FFR: macro.FFR,
          updatedAt: macro.updatedAt,
        } : null,
      });
    } catch (err) {
      logger.error("API /dashboard error:", err.message);
      return jsonResponse(res, { error: err.message });
    }
  }

  // === API: COT Data ===
  if (url === "/api/cot") {
    try {
      const { fetchCOTData } = require("./services/cotData");
      const cotResult = await fetchCOTData();
      // cotResult = { reportDate, contracts: [...] }
      const contracts = (cotResult?.contracts || []).map(c => ({
        alias: c.name || c.alias,
        category: c.category,
        netPosition: c.speculator?.net?.toLocaleString() || "N/A",
        commercialNet: c.commercial?.net?.toLocaleString() || "N/A",
        sentiment: c.sentiment || "NEUTRAL",
        cotIndex6M: c.marketBull?.cotIndex6M || "N/A",
        cotIndex36M: c.marketBull?.cotIndex36M || "N/A",
        chartUrl: c.marketBull?.chartUrl || "",
        lastUpdate: cotResult?.reportDate || "N/A",
      }));
      return jsonResponse(res, { data: contracts, reportDate: cotResult?.reportDate });
    } catch (err) {
      logger.error("API /cot error:", err.message);
      return jsonResponse(res, { error: err.message, data: [] });
    }
  }

  // 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found\n");
});

server.listen(PORT, () => {
  logger.info(`📡 Health check server listening on port ${PORT}`);
});

// === Error Handling & Graceful Shutdown ===
client.on("error", (error) => {
  logger.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  // Optional: Graceful exit after critical exception
  process.exit(1);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  server.close();
  client.destroy();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully...");
  server.close();
  client.destroy();
  process.exit(0);
});

// === Login ===
client.login(process.env.DISCORD_TOKEN);
