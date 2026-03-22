const { runMacroCycle } = require('../services/macroEngine');

async function sendMacroUpdate(client, silent = false) {
    try {
        // 🔥 PASS CLIENT
        await runMacroCycle(client, silent);
        console.log(`📤 Macro cycle completed${silent ? ' (Silent Mode)' : ''}`);

    } catch (err) {
        console.error("❌ Failed sending macro:", err);
    }
}

module.exports = { sendMacroUpdate };
