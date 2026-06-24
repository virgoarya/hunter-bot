const { updateMacroData, getMacroState } = require("./macroData");
const { saveSnapshot } = require("./macroHistory");
const { classifyRegime } = require("./regime");
const { buildBias } = require("./biasEngine");
const { buildSessionBias } = require("./sessionBias");
const { detectIntent } = require("./intentEngine");
const { detectRegimeShift } = require("./regimeTracker");
const { buildNarrative } = require("./narrativeBuilder");
const { detectCorrelationPatterns } = require("./correlationEngine");
const { analyzeRateOfChange } = require("./rateOfChange");
const { sendBiasBroadcast } = require("./broadcast");
const { sendShiftAlert } = require('./shiftAlert');
const { sendSessionAlert } = require('./sessionAlert');
const logger = require('../utils/logger');

async function runMacroCycle(client, silent = false) {

  logger.info("🔄 Running Macro Cycle...");

  // 1. Update data
  await updateMacroData();
  const state = getMacroState();

  if (!state?.isHealthy) {
    logger.info("⚠️ Macro data unhealthy — skipping cycle");
    return;
  }

  // Save history snapshot
  saveSnapshot(state);

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

  // 7. Session (with repo data for liquidity context)
  const session = buildSessionBias(regime, bias, intent, state.RepoData);

  // 10. Advanced Engines (New)
  const correlation = detectCorrelationPatterns(state);
  const rocShocks = analyzeRateOfChange(state);

  // 8. Alerts
  if (shift) {
    if (!silent) await sendShiftAlert(client, shift, narrative);
  }

  if (!silent) await sendSessionAlert(client, session);

  logger.info("📊 Macro Updated");
  logger.info(regime.regime, "|", intent.intent);

  // 9. Broadcast
  if (!silent) await sendBiasBroadcast(
    client,
    process.env.MACRO_CHANNEL_ID,
    regime,
    bias,
    session,
    shift,
    intent,
    narrative,
    state.RepoData,
    correlation,
    rocShocks
  );
}

module.exports = { runMacroCycle };
