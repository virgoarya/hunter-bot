const { fetchMarketBullCOT } = require('./services/marketBullScraper');
const fs = require('fs');
const path = require('path');

const ASSET_KEYS = ['eur', 'gbp', 'jpy', 'aud', 'cad', 'chf', 'gold', 'sp500', 'nasdaq', 'usd'];

async function generateMirror() {
    const data = {};
    let lastUpdate = new Date().toISOString().split('T')[0];

    for (const key of ASSET_KEYS) {
        try {
            const d = await fetchMarketBullCOT(key);
            if (d && d.netPosition !== "N/A") {
                data[key] = {
                    index6M: d.cotIndex6M,
                    index36M: d.cotIndex36M,
                    netPosition: d.netPosition,
                    lastUpdate: d.lastUpdate || lastUpdate
                };
                if (d.lastUpdate && d.lastUpdate !== "N/A") {
                    lastUpdate = d.lastUpdate; // use most recent
                }
                console.log(`✅ ${key}: ${d.netPosition} | ${d.cotIndex6M}`);
            } else {
                console.log(`⚠️ ${key}: No data`);
            }
        } catch (e) {
            console.error(`❌ ${key}: ${e.message}`);
        }
    }

    const mirror = {
        lastUpdate,
        data
    };

    const mirrorPath = path.join(__dirname, 'data', 'marketbull_cot.json');
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    fs.writeFileSync(mirrorPath, JSON.stringify(mirror, null, 2));
    console.log(`\n📦 Mirror saved to ${mirrorPath} (${Object.keys(data).length} assets)`);
}

generateMirror().catch(console.error);
