const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

// MOCKING NITTER FAILURE
const RSS_URLS = ["https://broken-nitter-instance.com/rss"];
const TELEGRAM_URL = "https://t.me/s/TheKobeissiLetter";

// RE-IMPLEMENTING LOGIC FROM twitterService.js for isolated test
async function fetchFromTelegram() {
    try {
        console.log("✈️ Nitter failed, falling back to Telegram Scraper...");
        const response = await axios.get(TELEGRAM_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const items = [];

        $(".tgme_widget_message_wrap").each((i, el) => {
            const text = $(el).find(".tgme_widget_message_text").text();
            const date = $(el).find(".tgme_widget_message_date time").attr("datetime");
            const link = $(el).find(".tgme_widget_message_date").attr("href");

            if (text && link) {
                items.push({
                    id: link,
                    content: text,
                    link: link,
                    date: date
                });
            }
        });

        return items.reverse();
    } catch (e) {
        console.error("❌ Telegram fallback also failed:", e.message);
        return [];
    }
}

async function testFallback() {
    console.log("--- TESTING NITTER -> TELEGRAM FALLBACK ---");
    let items = [];
    
    // Step 1: Simulated Nitter Failure
    for (const url of RSS_URLS) {
        try {
            console.log(`📡 Trying Nitter: ${url}`);
            await axios.get(url, { timeout: 2000 });
        } catch (e) {
            console.log(`⚠️ Nitter failed as expected: ${e.message}`);
        }
    }
    
    // Step 2: Fallback
    if (items.length === 0) {
        items = await fetchFromTelegram();
    }
    
    if (items.length > 0) {
        console.log(`✅ SUCCESS! Fallback fetched ${items.length} items from Telegram.`);
        console.log(`Sample content: ${items[0].content.substring(0, 50)}...`);
        process.exit(0);
    } else {
        console.log("❌ FAILED: Fallback returned nothing.");
        process.exit(1);
    }
}

testFallback();
