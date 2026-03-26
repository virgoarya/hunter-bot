const te = require('tradingeconomics');

/**
 * Fetch economic calendar from TradingEconomics API
 * Requires TRADINGECONOMICS_API_KEY in format "key:secret" or just "key"
 * Get your key at: http://developer.tradingeconomics.com
 */
async function fetchTradingEconomicsCalendar() {
  try {
    const apiKey = process.env.TRADINGECONOMICS_API_KEY;
    if (!apiKey) {
      console.log("⚠️ TradingEconomics: No API key (TRADINGECONOMICS_API_KEY)");
      return [];
    }

    // Login with the API key
    te.login(apiKey);

    // Fetch calendar for major countries only
    const countries = ['United States', 'Euro Zone', 'United Kingdom', 'Japan', 'Switzerland', 'Canada'];
    const allEvents = [];

    for (const country of countries) {
      try {
        // Fetch calendar for this country (next 7 days)
        const events = await te.getCalendar({
          country: country.toLowerCase(),
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          importance: '1' // Only high impact events
        });

        if (Array.isArray(events)) {
          const mapped = events.map(e => ({
            type: 'event',
            source: 'TradingEconomics',
            date: e.date || e.DateTime,
            country: mapCountry(e.country || e.Country),
            event: e.event || e.Category || e.indicator || 'Unknown',
            impact: mapImpact(e.importance || e.Importance),
            forecast: e.forecast || e.Forecast || 'N/A',
            previous: e.previous || e.Previous || 'N/A',
            actual: e.actual || e.Actual || 'N/A',
            // Keep original reference for matching
            _teEvent: e
          })).filter(e => e.country && e.event); // Filter valid entries

          allEvents.push(...mapped);
          console.log(`✅ TradingEconomics [${country}]: ${mapped.length} high-impact events`);
        }
      } catch (err) {
        console.warn(`⚠️ TradingEconomics [${country}] failed:`, err.message);
      }
    }

    console.log(`✅ TradingEconomics total: ${allEvents.length} events`);
    return allEvents;

  } catch (error) {
    console.error("❌ TradingEconomics error:", error.message);
    return [];
  }
}

function mapCountry(country) {
  if (!country) return 'Unknown';
  const c = country.toLowerCase();
  if (c.includes('united states') || c.includes('usa')) return 'USD';
  if (c.includes('euro') || c.includes('european union')) return 'EUR';
  if (c.includes('united kingdom') || c.includes('uk')) return 'GBP';
  if (c.includes('japan')) return 'JPY';
  if (c.includes('switzerland')) return 'CHF';
  if (c.includes('canada')) return 'CAD';
  return country.toUpperCase().substring(0, 3);
}

function mapImpact(imp) {
  if (!imp) return 'Low';
  const i = String(imp).toLowerCase();
  if (i === '1' || i === 'high') return 'High';
  if (i === '2' || i === 'medium') return 'Medium';
  return 'Low';
}

module.exports = { fetchTradingEconomicsCalendar };
