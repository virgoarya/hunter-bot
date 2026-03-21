const { fetchLiquidityFlow, formatFlowSummary, buildFlowEmbed } = require('./services/liquidityFlow');

async function testFlow() {
    console.log("Fetching Liquidity Flow...");
    try {
        const flowData = await fetchLiquidityFlow(true); // force refresh
        console.log("Flow Data:", JSON.stringify(flowData, null, 2));
        
        console.log("\n--- TEXT SUMMARY ---");
        console.log(formatFlowSummary(flowData));
        
        console.log("\n--- DISCORD EMBED ---");
        const embedPayload = buildFlowEmbed(flowData);
        if (embedPayload.embeds && embedPayload.embeds.length > 0) {
            const embed = embedPayload.embeds[0];
            console.log("Title:", embed.data.title);
            console.log("Fields:", JSON.stringify(embed.data.fields, null, 2));
        }
    } catch (e) {
        console.error("Test error:", e);
    }
}

testFlow();
