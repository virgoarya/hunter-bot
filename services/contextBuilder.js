function buildMacroContext(state, regime, bias, session) {
  return `
LINGKUNGAN MAKRO:

DXY: \${state.DXY.close}
NASDAQ: \${state.NASDAQ.close}
GOLD: \${state.GOLD.close}
US10Y: \${state.US10Y.close}
VIX: \${state.VIX.close}

REZIM: \${regime.regime}
DESKRIPSI: \${regime.description}

BIAS PASAR:
USD: \${bias.usdBias}
EMAS: \${bias.goldBias}
SAHAM: \${bias.equityBias}

OUTLOOK SESI:
LONDON: \${session.londonBias}
NEW YORK: \${session.newyorkBias}

Gunakan data ini untuk berpikir seperti trader makro institusional.
JANGAN memberikan jawaban generik.
Berpikirlah dalam konteks aliran (flows), sentimen risiko, dan positioning.
`;
}

module.exports = { buildMacroContext };