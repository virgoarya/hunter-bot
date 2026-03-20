const { runMacroCycle } = require('../services/macroEngine');

async function sendMacroUpdate(client) {
    try {
        // 🔥 PASS CLIENT
        await runMacroCycle(client);
        console.log("📤 Macro cycle completed");

    } catch (err) {
        console.error("❌ Failed sending macro:", err);
    }
}

module.exports = { sendMacroUpdate };
