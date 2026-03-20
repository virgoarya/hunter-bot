const cron = require("node-cron");

/**
 * Unified broadcast scheduler using node-cron
 * All times are in UTC (WIB = UTC+7)
 *
 * Schedule (WIB / Local Time):
 * - Morning Outlook:  09:30 WIB — Mon-Fri
 * - Calendar Daily:   09:30 WIB — Mon-Fri
 * - London Session:   12:00 WIB — Mon-Fri
 * - NY Session:       18:00 WIB — Mon-Fri
 * - Macro Update:     Every 6 hours
 * - COT Weekly:       21:00 WIB — Sunday
 * - Event Alert:      Every 15 minutes
 */

function startAllSchedulers(callbacks) {
    console.log("⏱️ Broadcast Scheduler Starting (WIB Local Time)...\n");

    // === MORNING OUTLOOK (09:30 WIB Mon-Fri) ===
    if (callbacks.morningOutlook) {
        cron.schedule("30 9 * * 1-5", async () => {
            console.log("🌅 Triggering Morning Outlook...");
            try {
                await callbacks.morningOutlook();
            } catch (err) {
                console.error("❌ Morning Outlook error:", err.message);
            }
        });
        console.log("  ✅ Morning Outlook: 09:00 WIB (Mon-Fri)");
    }

    // === CALENDAR DAILY (09:30 WIB Mon-Fri) ===
    if (callbacks.calendarDaily) {
        // Offset by 1 minute to avoid race conditions
        cron.schedule("31 9 * * 1-5", async () => {
            console.log("📅 Triggering Calendar Broadcast...");
            try {
                await callbacks.calendarDaily();
            } catch (err) {
                console.error("❌ Calendar Broadcast error:", err.message);
            }
        });
        console.log("  ✅ Calendar Daily: 09:00 WIB (Mon-Fri)");
    }

    // === LONDON SESSION (12:00 WIB Mon-Fri) ===
    if (callbacks.londonSession) {
        cron.schedule("0 12 * * 1-5", async () => {
            console.log("🌍 Triggering London Session Outlook...");
            try {
                await callbacks.londonSession();
            } catch (err) {
                console.error("❌ London Session error:", err.message);
            }
        });
        console.log("  ✅ London Session: 12:00 WIB (Mon-Fri)");
    }

    // === NEW YORK SESSION (18:00 WIB Mon-Fri) ===
    if (callbacks.nySession) {
        cron.schedule("0 18 * * 1-5", async () => {
            console.log("🇺🇸 Triggering NY Session Outlook...");
            try {
                await callbacks.nySession();
            } catch (err) {
                console.error("❌ NY Session error:", err.message);
            }
        });
        console.log("  ✅ NY Session: 18:00 WIB (Mon-Fri)");
    }

    // === MACRO UPDATE (Every 6 hours) ===
    if (callbacks.macroUpdate) {
        cron.schedule("0 */6 * * *", async () => {
            console.log("🔄 Triggering Macro Update...");
            try {
                await callbacks.macroUpdate();
            } catch (err) {
                console.error("❌ Macro Update error:", err.message);
            }
        });
        console.log("  ✅ Macro Update: Every 6 hours");
    }

    // === COT WEEKLY (21:00 WIB Sunday) ===
    if (callbacks.cotWeekly) {
        cron.schedule("0 21 * * 0", async () => {
            console.log("📊 Triggering COT Weekly Report...");
            try {
                await callbacks.cotWeekly();
            } catch (err) {
                console.error("❌ COT Weekly error:", err.message);
            }
        });
        console.log("  ✅ COT Weekly: 21:00 WIB (Sunday)");
    }

    // === HIGH IMPACT EVENT ALERT (Every 15 minutes) ===
    if (callbacks.eventAlert) {
        cron.schedule("*/15 * * * *", async () => {
            try {
                await callbacks.eventAlert();
            } catch (err) {
                console.error("❌ Event Alert error:", err.message);
            }
        });
        console.log("  ✅ Event Alert Check: Every 15 minutes");
    }

    // === NEW DATA RELEASE ALERT (Every 5 minutes) ===
    if (callbacks.releaseAlert) {
        cron.schedule("*/5 * * * *", async () => {
            try {
                await callbacks.releaseAlert();
            } catch (err) {
                console.error("❌ Release Alert error:", err.message);
            }
        });
        console.log("  ✅ AI Release Analyzer: Every 5 minutes");
    }

    // === TWITTER FEEDS (Every 10 minutes) ===
    if (callbacks.twitterUpdates) {
        cron.schedule("*/10 * * * *", async () => {
            try {
                await callbacks.twitterUpdates();
            } catch (err) {
                console.error("❌ Twitter Feeds error:", err.message);
            }
        });
        console.log("  ✅ Twitter Feeds (@KobeissiLetter): Every 10 minutes");
    }

    // === REUTERS FINANCE (Every 30 minutes) ===
    if (callbacks.reutersUpdates) {
        cron.schedule("*/30 * * * *", async () => {
            try {
                await callbacks.reutersUpdates();
            } catch (err) {
                console.error("❌ Reuters Finance error:", err.message);
            }
        });
        console.log("  ✅ Reuters Finance: Every 30 minutes");
    }

    console.log("\n⏱️ All schedulers active!\n");

    // Run initial macro update on startup
    if (callbacks.macroUpdate) {
        console.log("🚀 Running initial macro update...");
        callbacks.macroUpdate().catch((err) =>
            console.error("❌ Initial macro error:", err.message)
        );
    }
}

module.exports = { startAllSchedulers };