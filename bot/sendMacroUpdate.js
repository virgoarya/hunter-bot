const logger = require("../utils/logger");
const { runMacroCycle } = require('../services/macroEngine');

async function sendMacroUpdate(client, silent = false) {
    try {
        // 🔥 PASS CLIENT
        await runMacroCycle(client, silent);
        logger.info(`📤 Macro cycle completed${silent ? ' (Silent Mode)' : ''}`);

    } catch (err) {
        logger.error("❌ Failed sending macro:", err);
    }
}

module.exports = { sendMacroUpdate };
