const axios = require('axios');
const cheerio = require('cheerio');

async function scrape() {
    try {
        const response = await axios.get('https://www.marketwatch.com/economy-politics/calendar', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(response.data);
        const events = [];

        $('table tbody tr').each((i, el) => {
            const time = $(el).find('td').eq(0).text().trim();
            const country = "USD"; // MarketWatch is US focused usually
            const indicator = $(el).find('td').eq(1).text().trim();
            const period = $(el).find('td').eq(2).text().trim();
            const actual = $(el).find('td').eq(3).text().trim();
            const forecast = $(el).find('td').eq(4).text().trim();
            const previous = $(el).find('td').eq(5).text().trim();

            if (indicator) {
                events.push({ time, indicator, period, actual, forecast, previous });
            }
        });

        const pmi = events.filter(e => e.indicator.includes('ISM Manufacturing'));
        console.log(JSON.stringify(pmi, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}

scrape();
