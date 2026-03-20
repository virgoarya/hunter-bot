const { updateMacroData, getMacroState } = require("./macroData");
const { classifyRegime } = require("./regime");
const { buildBias } = require("./biasEngine");
const { buildSessionBias } = require("./sessionBias");
const { detectIntent } = require("./intentEngine");
const { detectRegimeShift } = require("./regimeTracker");
const { buildNarrative } = require("./narrativeBuilder");
const { sendBiasBroadcast } = require("./broadcast");
const { sendShiftAlert } = require('./shiftAlert');
const { sendSessionAlert } = require('./sessionAlert');

async function runMacroCycle(client) {

  console.log("🔄 Running Macro Cycle...");

  // 1. Update data
  await updateMacroData();
  const state = getMacroState();

  if (!state?.isHealthy) {
    console.log("⚠️ Macro data unhealthy — skipping cycle");
    return;
  }

  // 2. Regime
  const regime = classifyRegime(state);

  // 3. Bias
  const bias = buildBias(state, regime);

  // 4. Intent
  const intent = detectIntent(state);

  // 5. Detect shift
  const shift = detectRegimeShift(regime);

  // 6. Narrative
  const narrative = buildNarrative(regime, bias, intent, shift);

  // 7. Session
  const session = buildSessionBias(regime, bias, intent);

  // 8. Alerts
  if (shift) {
    await sendShiftAlert(client, shift, narrative);
  }
  
  await sendSessionAlert(client, session);

  console.log("📊 Macro Updated");
  console.log(regime.regime, "|", intent.intent);

  // 9. Broadcast
  await sendBiasBroadcast(
    client,
    process.env.MACRO_CHANNEL_ID,
    regime,
    bias,
    session,
    shift,
    intent,
    narrative
  );
}

module.exports = { runMacroCycle };
