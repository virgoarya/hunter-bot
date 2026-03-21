const { postToAI } = require("./utils/aiProxy");
require("dotenv").config();

async function testMultiProvider() {
    console.log("=== TESTING MULTI-PROVIDER AI PROXY ===\n");

    const messages = [{ role: "user", content: "Say 'Hello from AI Proxy' in Indonesian." }];

    // Test 1: Primary (OpenRouter)
    // console.log("--- Test 1: Primary (OpenRouter) ---");
    // try {
    //     const res1 = await postToAI(messages, { temperature: 0.5 });
    //     console.log("Result:", res1);
    // } catch (e) {
    //     console.log("Expected if 429 occurs, moving to next test...");
    // }

    // Test 2: Gemini Fallback (Simulation)
    console.log("\n--- Test 2: Gemini Failover (Simulating 429) ---");
    // We can simulate failover by temporarily breaking OR credentials in the thread
    const oldKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "sk-or-v1-invalid-key-to-force-failover";

    try {
        const res2 = await postToAI(messages, { temperature: 0.5 });
        console.log("Result:", res2);
    } catch (e) {
        console.error("Final Failure:", e.message);
    } finally {
        process.env.OPENROUTER_API_KEY = oldKey;
    }
}

testMultiProvider();
