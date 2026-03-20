let previousRegime = null;

function detectRegimeShift(currentRegime) {
  let shift = null;

  if (!previousRegime) {
    previousRegime = currentRegime.regime;
    return null;
  }

  if (previousRegime !== currentRegime.regime) {
    shift = {
      from: previousRegime,
      to: currentRegime.regime
    };
  }

  previousRegime = currentRegime.regime;
  return shift;
}

module.exports = { detectRegimeShift };