require("dotenv").config();
const { generateReply } = require("./services/aiResponder");
const { updateMacroData } = require("./services/macroData");

async function test() {
    console.log("Updating macro data (including Oil and FFR)...");
    await updateMacroData();

    console.log("\nTesting Hunter AI Responder (Honesty Protocol Check)...");
    const questions = [
        "Berapa harga Gold sekarang vs 1 minggu lalu? Cite sumber data spesifik.",
        "Berapa Fed Funds Rate terbaru?",
        "Hitung Sharpe ratio gold YTD 2026 dan berikan rekomendasi position sizing (risk 2%)."
    ];
    
    for (const q of questions) {
        console.log(`\n--- USER: ${q} ---`);
        const reply = await generateReply(q, "test-user-3");
        console.log("\n--- AI RESPONSE ---");
        console.log(reply);
        console.log("-------------------");
    }
}

test();
