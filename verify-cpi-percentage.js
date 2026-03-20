require("dotenv").config();
const { generateReply } = require("./services/aiResponder");

async function verify() {
    console.log("--- FINAL AI VERIFICATION: CPI PERCENTAGE ---");
    const question = "Berapa data actual CPI hari ini 11 Maret 2026? Analisa market berdasarkan data tersebut.";
    
    console.log(`Question: ${question}`);
    console.log("\nGenerating reply...");
    
    const reply = await generateReply(question, null);
    
    console.log("\n--- AI REPLY ---");
    console.log(reply);
    console.log("-----------------");

    if (reply.includes("%") && !reply.includes("13 Maret") && !reply.includes("326.79")) {
        console.log("\n✅ Success! AI reported percentage data and correct date.");
    } else {
        console.log("\n❌ Failed. AI might still be reporting index or wrong date.");
    }
}

verify();
