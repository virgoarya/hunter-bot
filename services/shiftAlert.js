async function sendShiftAlert(client, shift, narrative) {

    if (!shift) return;

    const channel = await client.channels.fetch(process.env.MACRO_CHANNEL_ID);

    if (!channel) return;

    const message = `
🚨 **REGIME SHIFT DETECTED**

${shift.from} → ${shift.to}

🧠 ${narrative}
    `;

    await channel.send(message);

    console.log("🚨 Shift Alert Sent");
}

module.exports = { sendShiftAlert };