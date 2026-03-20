function isLondonOpen() {
    const hour = new Date().getUTCHours();
    return hour === 7;
}

function isNewYorkOpen() {
    const hour = new Date().getUTCHours();
    return hour === 13;
}

async function sendSessionAlert(client, session) {

    const channel = await client.channels.fetch(process.env.MACRO_CHANNEL_ID);
    if (!channel) return;

    if (isLondonOpen()) {

        await channel.send(`
🌍 **LONDON OPEN FLOW**

${session.londonBias}
        `);

        console.log("🌍 London Alert Sent");
    }

    if (isNewYorkOpen()) {

        await channel.send(`
🇺🇸 **NEW YORK OPEN FLOW**

${session.newyorkBias}
        `);

        console.log("🇺🇸 NY Alert Sent");
    }
}

module.exports = { sendSessionAlert };