const logger = require('./logger');
const cron = require("node-cron");

/**
 * Unified broadcast scheduler using node-cron
 * All times are in WIB (Waktu Indonesia Barat, UTC+7)
 *
 * Schedule (WIB):
 * - Morning Outlook:  09:30 WIB — Mon-Fri
 * - Calendar Daily:   09:31 WIB — Mon-Fri
 * - London Session:   12:00 WIB — Mon-Fri
 * - NY Session:       18:00 WIB — Mon-Fri
 * - Macro Update:     Every 6 hours
 * - COT Weekly:       21:00 WIB — Sunday
 * - Event Alert:      Every 15 minutes
 * - Release Alert:    Every 5 minutes
 * - Twitter Updates:  Every 10 minutes
 * - Reuters Updates:  Every 30 minutes
 */

function startAllSchedulers(callbacks) {
    logger.info("⏱️ Broadcast Scheduler Starting (WIB Local Time)...\n");

    // === MORNING OUTLOOK (09:30 WIB Mon-Fri) ===
    if (callbacks.morningOutlook) {
        cron.schedule("30 9 * * 1-5", async () => {
            logger.info("🌅 Triggering Morning Outlook...");
            try {
                await callbacks.morningOutlook();
            } catch (err) {
                logger.error("❌ Morning Outlook error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ Morning Outlook: 09:30 WIB (Mon-Fri)");
    }

    // === CALENDAR DAILY (09:31 WIB Mon-Fri) ===
    if (callbacks.calendarDaily) {
        // Offset by 1 minute to avoid race conditions
        cron.schedule("31 9 * * 1-5", async () => {
            logger.info("📅 Triggering Calendar Broadcast...");
            try {
                await callbacks.calendarDaily();
            } catch (err) {
                logger.error("❌ Calendar Broadcast error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ Calendar Daily: 09:31 WIB (Mon-Fri)");
    }

    // === LONDON SESSION (12:00 WIB Mon-Fri) ===
    if (callbacks.londonSession) {
        cron.schedule("0 12 * * 1-5", async () => {
            logger.info("🌍 Triggering London Session Outlook...");
            try {
                await callbacks.londonSession();
            } catch (err) {
                logger.error("❌ London Session error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ London Session: 12:00 WIB (Mon-Fri)");
    }

    // === NEW YORK SESSION (18:00 WIB Mon-Fri) ===
    if (callbacks.nySession) {
        cron.schedule("0 18 * * 1-5", async () => {
            logger.info("🇺🇸 Triggering NY Session Outlook...");
            try {
                await callbacks.nySession();
            } catch (err) {
                logger.error("❌ NY Session error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ NY Session: 18:00 WIB (Mon-Fri)");
    }

    // === MACRO UPDATE (Every 6 hours) ===
    if (callbacks.macroUpdate) {
        cron.schedule("0 */6 * * *", async () => {
            logger.info("🔄 Triggering Macro Update...");
            try {
                await callbacks.macroUpdate();
            } catch (err) {
                logger.error("❌ Macro Update error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ Macro Update: Every 6 hours");
    }

    // === COT WEEKLY (21:00 WIB Sunday) ===
    if (callbacks.cotWeekly) {
        cron.schedule("0 21 * * 0", async () => {
            logger.info("📊 Triggering COT Weekly Report...");
            try {
                await callbacks.cotWeekly();
            } catch (err) {
                logger.error("❌ COT Weekly error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ COT Weekly: 21:00 WIB (Sunday)");
    }

    // === HIGH IMPACT EVENT ALERT (Every 15 minutes) ===
    if (callbacks.eventAlert) {
        cron.schedule("*/15 * * * *", async () => {
            try {
                await callbacks.eventAlert();
            } catch (err) {
                logger.error("❌ Event Alert error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ Event Alert Check: Every 15 minutes");
    }

    // === NEW DATA RELEASE ALERT (Every 5 minutes) ===
    if (callbacks.releaseAlert) {
        cron.schedule("*/5 * * * *", async () => {
            try {
                await callbacks.releaseAlert();
            } catch (err) {
                logger.error("❌ Release Alert error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ AI Release Analyzer: Every 5 minutes");
    }

    // === TWITTER FEEDS (Every 10 minutes) ===
    if (callbacks.twitterUpdates) {
        cron.schedule("*/10 * * * *", async () => {
            try {
                await callbacks.twitterUpdates();
            } catch (err) {
                logger.error("❌ Twitter Feeds error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ Twitter Feeds (@KobeissiLetter): Every 10 minutes");
    }

    // === REUTERS FINANCE (Every 2 hours) ===
    if (callbacks.reutersUpdates) {
        cron.schedule("0 */2 * * *", async () => {
            try {
                await callbacks.reutersUpdates();
            } catch (err) {
                logger.error("❌ Reuters Finance error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ Reuters Finance: Every 2 hours");
    }

    // === MACRO NEWS ANALYSIS (Critical Thinking) - Every 2 hours ===
    if (callbacks.macroNewsAnalysis) {
        cron.schedule("0 */2 * * *", async () => {
            try {
                logger.info("🧠 Triggering Macro News Analysis (Critical Thinking)...");
                await callbacks.macroNewsAnalysis();
            } catch (err) {
                logger.error("❌ Macro News Analysis error:", err.message);
            }
        }, { timezone: 'Asia/Jakarta' });
        logger.info("  ✅ Macro News Analysis (Critical Thinking): Every 2 hours");
    }

    logger.info("\n⏱️ All schedulers active!\n");

    // Run initial macro update on startup (silent, no broadcast)
    if (callbacks.macroUpdate) {
        logger.info("🚀 Running initial macro update (Silent Mode)...");
        callbacks.macroUpdate(true).catch((err) =>
            logger.error("❌ Initial macro error:", err.message)
        );
    }
}

module.exports = { startAllSchedulers };