#!/usr/bin/env node

/**
 * COT Mirrors Update Script
 *
 * Updates local mirror files with fresh data:
 *  - CFTC: Fetches from cftc.gov (may fail from Cloudflare, uses curl with UA)
 *  - MarketBull: Manual only (Cloudflare protected), requires manual intervention
 *
 * Usage: node update-cot-mirrors.js [options]
 *
 * Options:
 *   --cftc-only      Update only CFTC mirror
 *   --marketbull     Update MarketBull mirror (requires manual run from IP that can access)
 *   --dry-run        Show what would be updated without saving
 *   --push           Commit and push changes to git remote
 *
 * Examples:
 *   node update-cot-mirrors.js --cftc-only        # Weekly CFTC update
 *   node update-cot-mirrors.js --marketbull       # Manual MarketBull update (run from local)
 *   node update-cot-mirrors.js --cftc-only --push # Auto-deploy to Railway
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CFTC_URL = 'https://www.cftc.gov/dea/newcot/deafut.txt';
const CFTC_LOCAL = path.join(__dirname, 'data', 'cot_raw.txt');
const MARKETBULL_ASSETS = {
    eur: 'https://market-bulls.com/cot-report-euro-fx-eur/',
    gbp: 'https://market-bulls.com/cot-report-british-pound-gbp/',
    jpy: 'https://market-bulls.com/cot-report-japanese-yen-jpy/',
    aud: 'https://market-bulls.com/cot-report-australian-dollar-aud/',
    cad: 'https://market-bulls.com/cot-report-canadian-dollar-cad/',
    chf: 'https://market-bulls.com/cot-report-swiss-franc-chf/',
    gold: 'https://market-bulls.com/cot-report-gold/',
    sp500: 'https://market-bulls.com/cot-report-sp-500/',
    nasdaq: 'https://market-bulls.com/cot-report-nasdaq-100/',
    usd: 'https://market-bulls.com/cot-report-us-dollar-usd/'
};
const MARKETBULL_MIRROR = path.join(__dirname, 'data', 'marketbull_cot.json');

async function downloadCFTC() {
    console.log('📡 Downloading CFTC data...');
    try {
        // Use curl with browser-like UA to bypass some protections
        const cmd = `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "${CFTC_URL}" -o "${CFTC_LOCAL}"`;
        execSync(cmd, { stdio: 'inherit' });
        const stats = fs.statSync(CFTC_LOCAL);
        if (stats.size < 1000) {
            throw new Error(`Downloaded file too small (${stats.size} bytes), likely failed`);
        }
        console.log(`✅ CFTC mirror updated: ${stats.size} bytes`);
        return true;
    } catch (err) {
        console.error('❌ Failed to update CFTC mirror:', err.message);
        return false;
    }
}

async function downloadMarketBull() {
    console.log('\n📊 Downloading MarketBull data...');
    const data = {};
    let lastUpdate = new Date().toISOString().split('T')[0];

    for (const [key, url] of Object.entries(MARKETBULL_ASSETS)) {
        try {
            console.log(`  Fetching ${key}...`);
            // Use curl with UA
            const tmpFile = path.join(__dirname, 'tmp', `${key}.html`);
            fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
            const cmd = `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${url}" -o "${tmpFile}"`;
            const exitCode = execSync(cmd, { stdio: 'ignore' }).status;

            if (exitCode !== 0) {
                throw new Error(`curl exited with code ${exitCode}`);
            }

            const html = fs.readFileSync(tmpFile, 'utf8');

            // Check if Cloudflare challenge
            if (html.includes('cf-browser-verification') || html.includes('Checking your browser')) {
                throw new Error('Cloudflare challenge detected - manual intervention required');
            }

            // Parse HTML (basic parsing for demonstration)
            const index6M = html.match(/6 Month.*?<span[^>]*>([^<]+)<\/span>/i)?.[1]?.trim() || 'N/A';
            const index36M = html.match(/36 Month.*?<span[^>]*>([^<]+)<\/span>/i)?.[1]?.trim() || 'N/A';
            const netPosMatch = html.match(/Net Position.*?<td[^>]*>([^<]+)<\/td>/i);
            const netPos = netPosMatch ? netPosMatch[1].trim() : 'N/A';
            const dateMatch = html.match(/Report Date:.*?(\d{4}-\d{2}-\d{2})/i);
            const reportDate = dateMatch ? dateMatch[1] : 'N/A';

            data[key] = {
                index6M: index6M.replace(/%/g, '') + '%',
                index36M: index36M.replace(/%/g, '') + '%',
                netPosition: netPos,
                url
            };

            if (reportDate !== 'N/A') lastUpdate = reportDate;
            console.log(`    ✅ ${key}: ${netPos} (Index6M: ${index6M})`);
        } catch (err) {
            console.warn(`    ⚠️ ${key}: ${err.message}`);
        } finally {
            // Cleanup tmp file
            try {
                fs.unlinkSync(path.join(__dirname, 'tmp', `${key}.html`));
            } catch (e) { }
        }
    }

    // Cleanup tmp dir
    try {
        fs.rmdirSync(path.join(__dirname, 'tmp'));
    } catch (e) { }

    const mirror = { lastUpdate, data };
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    fs.writeFileSync(MARKETBULL_MIRROR, JSON.stringify(mirror, null, 2));
    console.log(`✅ MarketBull mirror updated: ${Object.keys(data).length} assets`);
    return true;
}

function pushToGit() {
    console.log('\n📤 Pushing changes to git...');
    try {
        execSync('git add data/cot_raw.txt data/marketbull_cot.json', { stdio: 'inherit' });
        const commitMsg = `update: COT mirrors - ${new Date().toISOString().split('T')[0]}`;
        execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
        execSync('git push origin main', { stdio: 'inherit' });
        console.log('✅ Changes pushed to remote');
        return true;
    } catch (err) {
        console.error('❌ Git push failed:', err.message);
        return false;
    }
}

async function main() {
    const args = new Set(process.argv.slice(2));
    const dryRun = args.has('--dry-run');
    const push = args.has('--push');
    const cftcOnly = args.has('--cftc-only');
    const marketbull = args.has('--marketbull');

    console.log('🔄 COT Mirrors Update\n');
    console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE');
    console.log('Push to git:', push ? 'YES' : 'NO');
    console.log('');

    let cftcUpdated = false;
    let mbUpdated = false;

    if (!dryRun) {
        // CFTC Update (can run from any IP, usually works)
        cftcUpdated = await downloadCFTC();
        if (!cftcUpdated) {
            console.log('⚠️ CFTC update failed but continuing...');
        }

        // MarketBull Update (only works from non-cloudflare-blocked IPs)
        if (marketbull || !cftcOnly) {
            mbUpdated = await downloadMarketBull();
            if (!mbUpdated) {
                console.log('⚠️ MarketBull update failed (this is normal from Railway)');
            }
        }
    } else {
        console.log('DRY RUN - would update:');
        console.log('  - CFTC mirror (cot_raw.txt)');
        console.log('  - MarketBull mirror (marketbull_cot.json)');
    }

    if (push && !dryRun) {
        if (cftcUpdated || mbUpdated) {
            pushToGit();
        } else {
            console.log('⚠️ No changes to push');
        }
    }

    console.log('\n✅ Update complete');
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
