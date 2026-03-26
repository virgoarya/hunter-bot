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
      console.log("⚠️ TradingEconomics: No API key (TRADINGECONOMICS_API_KEY) set. Skipping.");
      return [];
    }

    // Login with the API key
    try {
      te.login(apiKey);
    } catch (loginErr) {
      console.error("❌ TradingEconomics login failed:", loginErr.message);
      return [];
    }

    // Fetch calendar for major countries only
    const countries = ['United States', 'Euro Zone', 'United Kingdom', 'Japan', 'Switzerland', 'Canada'];
    const allEvents = [];

    console.log("📡 Fetching Economic Calendar from TradingEconomics...");

    for (const country of countries) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Fetch calendar for this country (next 7 days)
        const events = await te.getCalendar({
          country: country.toLowerCase(),
          start_date: today,
          end_date: nextWeek,
          importance: '1' // Only high impact events
        });

        if (Array.isArray(events) && events.length > 0) {
          console.log(`  📊 Raw TE [${country}]: ${events.length} events`);
          const mapped = events.map(e => {
            const mapped = {
              type: 'event',
              source: 'TradingEconomics',
              date: e.date || e.DateTime,
              country: mapCountry(e.country || e.Country),
              event: e.event || e.Category || e.indicator || 'Unknown',
              impact: mapImpact(e.importance || e.Importance),
              forecast: e.forecast || e.Forecast || 'N/A',
              previous: e.previous || e.Previous || 'N/A',
              actual: e.actual || e.Actual || 'N/A',
            };
            return mapped;
          }).filter(e => {
            const valid = e.country && e.event && e.date && e.actual;
            if (!valid) {
              // Log why invalid for debugging
              // console.log(`    Filtered out TE event:`, e);
            }
            return valid;
          });

          if (mapped.length > 0) {
            allEvents.push(...mapped);
            console.log(`  ✅ TradingEconomics [${country}]: ${mapped.length} high-impact events with actuals`);
            // Show a sample
            if (mapped[0]) {
              console.log(`    Sample: ${mapped[0].country} ${mapped[0].event} | Actual: ${mapped[0].actual}`);
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️ TradingEconomics [${country}] failed:`, err.message);
      }
    }

    console.log(`✅ TradingEconomics total: ${allEvents.length} events with actual values`);
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
