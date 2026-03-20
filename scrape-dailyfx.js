const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeDailyFXActuals() {
    try {
        const url = 'https://www.dailyfx.com/economic-calendar';
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const releases = [];

        // DailyFX structure: events are often in .dfx-economicCalendar__item or similar
        // We'll look for released data (actual != empty)
        $('.dfx-economicCalendar__item').each((i, el) => {
            const country = $(el).find('.dfx-economicIndicator__country').text().trim();
            const title = $(el).find('.dfx-economicIndicator__title').text().trim();
            const actual = $(el).find('.dfx-economicIndicator__actual').text().trim();
            const forecast = $(el).find('.dfx-economicIndicator__forecast').text().trim();
            const previous = $(el).find('.dfx-economicIndicator__previous').text().trim();
            const date = $(el).attr('data-date'); // YYYY-MM-DD

            if (title && actual && actual !== '-') {
                releases.push({ date, country, title, actual, forecast, previous });
            }
        });

        return releases;
    } catch (error) {
        console.error("DailyFX Scrape Error:", error.message);
        return [];
    }
}

async function test() {
    const data = await scrapeDailyFXActuals();
    console.log(`Scraped ${data.length} releases.`);
    if (data.length > 0) {
        console.log("Sample released data:", JSON.stringify(data.slice(0, 3), null, 2));
    }
}

test();
