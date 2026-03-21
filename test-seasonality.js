const { buildBias } = require("./services/biasEngine");
const { buildNarrative } = require("./services/narrativeBuilder");

async function testSeasonality() {
    console.log("=== TESTING SEASONALITY TENDENCIES ===\n");

    const mockMacro = {
        DXY: { close: 100 },
        VIX: { close: 18 },
        US10Y: { close: 4.0 },
        RealYield: { close: 1.6 },
        NASDAQ: { close: 18000 },
        RepoData: { changePercent: 0 }
    };

    const mockRegime = { regime: "Pertumbuhan / Goldilocks" };

    // Test for different months by mocking Date.getMonth
    const months = [
        { id: 0, name: "January" },
        { id: 8, name: "September" },
        { id: 11, name: "December" }
    ];

    const originalGetMonth = Date.prototype.getMonth;

    for (const m of months) {
        console.log(`--- Testing Month: ${m.name} ---`);
        
        // Mock getMonth
        Date.prototype.getMonth = () => m.id;

        const bias = buildBias(mockMacro, mockRegime);
        const narrative = buildNarrative(mockRegime, bias);

        console.log(`USD Bias: ${bias.usdBias}`);
        console.log(`Gold Bias: ${bias.goldBias}`);
        console.log(`Equity Bias: ${bias.equityBias}`);
        console.log(`Narative: ${narrative}\n`);
    }

    // Restore getMonth
    Date.prototype.getMonth = originalGetMonth;
}

testSeasonality();
