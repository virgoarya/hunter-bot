const { getSnapshots } = require("./macroHistory");

let previousRegime = null;

function getHistoricalRegime(daysAgo = 1) {
  const snapshots = getSnapshots();
  if (!snapshots || snapshots.length === 0) return null;

  const targetTime = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);
  
  // Find snapshot closest to targetTime
  let closest = snapshots[0];
  let minDiff = Math.abs(new Date(closest.timestamp).getTime() - targetTime);

  for (const snap of snapshots) {
    const diff = Math.abs(new Date(snap.timestamp).getTime() - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = snap;
    }
  }

  // Determine regime of that historical snapshot
  if (closest) {
    // Re-evaluate regime using historical data
    try {
      const { classifyRegime } = require("./regime");
      const mockState = {
        DXY: { close: closest.DXY, change: closest.DXY_change },
        US10Y: { close: closest.US10Y, change: closest.US10Y_change },
        VIX: { close: closest.VIX, change: closest.VIX_change },
        GOLD: { close: closest.GOLD, change: closest.GOLD_change },
        NASDAQ: { close: closest.NASDAQ, change: closest.NASDAQ_change },
        RepoData: { amount: closest.RepoAmount, changePercent: closest.RepoChange },
        isHealthy: true
      };
      
      const historicalRegime = classifyRegime(mockState);
      return historicalRegime.regime;
    } catch(e) {
      return null;
    }
  }
  return null;
}

function detectRegimeShift(currentRegime) {
  let shift = null;

  if (!previousRegime) {
    // Try to get regime from 1 day ago (24h) from history
    const hist = getHistoricalRegime(1);
    previousRegime = hist || currentRegime.regime;
    if (previousRegime === currentRegime.regime) {
        return null; // No shift yet
    }
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

module.exports = { detectRegimeShift, getHistoricalRegime };
