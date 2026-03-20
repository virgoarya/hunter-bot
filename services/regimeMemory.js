let lastRegime = null;

function trackRegime(currentRegime) {

  if (!currentRegime?.regime) {
    return null;
  }

  if (!lastRegime) {
    lastRegime = currentRegime.regime;
    return null;
  }

  if (lastRegime !== currentRegime.regime) {

    const shift = {
      from: lastRegime,
      to: currentRegime.regime
    };

    lastRegime = currentRegime.regime;

    return shift;
  }

  return null;
}

module.exports = { trackRegime };