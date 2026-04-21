const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
    try {
        console.log("Fetching FXStreet ID...");
        const res = await axios.get('https://www.fxstreet-id.com/news', {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        const $ = cheerio.load(res.data);
        console.log("Title :", $('title').text());

        const articles = [];
         // Check their article schema
        $('.fxs_headline_tiny, .fxs_headline_small, article, .fxs_news_item').each((i, el) => {
            let aTag = $(el).find('a').first();
            if(!aTag.length && $(el).is('a')) aTag = $(el);
            
            let title = aTag.text().trim() || $(el).text().trim();
            let link = aTag.attr('href');
            let time = $(el).find('time').attr('datetime') || $(el).find('.fxs_article_date').text().trim();
            
            if (title && link && !articles.find(a => a.link === link)) {
                // Ignore empty or dummy titles
                if(title.length > 10) {
                    // Absolute link
                    if(link.startsWith("/")) link = "https://www.fxstreet-id.com" + link;
                    articles.push({ title: title.replace(/\s+/g, ' '), link, time });
                }
            }
        });
        
        console.log("Found", articles.length, "articles.");
        console.log(articles.slice(0, 3)); // Output top 3
    } catch (e) {
        console.error("Error:", e.message);
    }
})();
