function classifySentiment(state) {
  if (!state.DXY || !state.US10Y || !state.NASDAQ || !state.GOLD) {
    return "Core Data Missing";
  }

  let score = 0;

  // USD
  if (state.DXY.close > state.DXY.open) score -= 1;
  else score += 1;

  // Equities
  if (state.NASDAQ.close > state.NASDAQ.open) score += 1;
  else score -= 1;

  // Gold (defensive)
  if (state.GOLD.close > state.GOLD.open) score -= 1;
  else score += 1;

  // Yield pressure
  if (state.US10Y.close > 4.1) score -= 1;
  if (state.US10Y.close < 3.9) score += 1;

  if (score >= 2) return "Strong Risk On 🔥";
  if (score === 1) return "Mild Risk On";
  if (score === 0) return "Mixed / Rotation";
  if (score === -1) return "Mild Risk Off";
  if (score <= -2) return "Strong Risk Off 🚨";

  return "Neutral";
}

module.exports = { classifySentiment };