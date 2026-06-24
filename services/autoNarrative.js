const logger = require('../utils/logger');
const { buildNarrative } = require("./narrativeBuilder");

function buildAutoNarrative(currentState, previousState) {

  if (!currentState) return null;

  let shift = null;

  // === DETECT REGIME SHIFT ===
  if (previousState && previousState.regime !== currentState.regime) {

    shift = {
      from: previousState.regime,
      to: currentState.regime
    };

    logger.info("⚠️ REGIME SHIFT DETECTED:", shift);
  }

  const narrative = buildNarrative(
    { regime: currentState.regime },
    currentState.bias,
    currentState.intent,
    shift
  );

  return narrative;
}

module.exports = { buildAutoNarrative };