/**
 * macroHistory.js
 * Menyimpan snapshot data makro setiap macro cycle (6 jam).
 * Menyediakan riwayat untuk adaptive thresholds, rate of change, dan trend memory.
 * Data disimpan di file JSON lokal — ringan, tanpa dependency.
 */

const fs = require("fs");
const path = require("path");

const HISTORY_FILE = path.join(__dirname, "../data/macroHistory.json");
const MAX_DAYS = 30; // Simpan data 30 hari terakhir

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
        }
    } catch (e) {
        console.error("Macro history load error:", e.message);
    }
    return { snapshots: [] };
}

function saveHistory(history) {
    try {
        const dir = path.dirname(HISTORY_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (e) {
        console.error("Macro history save error:", e.message);
    }
}

/**
 * Simpan snapshot data makro saat ini.
 * Dipanggil setiap macro cycle (6 jam).
 */
function saveSnapshot(macroState) {
    if (!macroState || !macroState.isHealthy) return;

    const snapshot = {
        timestamp: new Date().toISOString(),
        DXY: macroState.DXY?.close ?? null,
        US10Y: macroState.US10Y?.close ?? null,
        RealYield: macroState.RealYield?.close ?? null,
        VIX: macroState.VIX?.close ?? null,
        GOLD: macroState.GOLD?.close ?? null,
        NASDAQ: macroState.NASDAQ?.close ?? null,
        OIL: macroState.OIL?.close ?? null,
        FFR: macroState.FFR?.close ?? null,
        // Changes (for direction tracking)
        DXY_change: parseFloat(macroState.DXY?.change) || 0,
        US10Y_change: parseFloat(macroState.US10Y?.change) || 0,
        GOLD_change: parseFloat(macroState.GOLD?.change) || 0,
        NASDAQ_change: parseFloat(macroState.NASDAQ?.change) || 0,
        VIX_change: parseFloat(macroState.VIX?.change) || 0,
        // Repo data
        RepoAmount: macroState.RepoData?.amount ?? null,
        RepoChange: parseFloat(macroState.RepoData?.changePercent) || 0,
    };

    const history = loadHistory();
    history.snapshots.push(snapshot);

    // Purge data older than MAX_DAYS
    const cutoff = Date.now() - (MAX_DAYS * 24 * 60 * 60 * 1000);
    history.snapshots = history.snapshots.filter(s => new Date(s.timestamp).getTime() > cutoff);

    saveHistory(history);
    console.log(`📦 Macro snapshot saved (${history.snapshots.length} total)`);
}

/**
 * Ambil semua snapshot dari riwayat.
 */
function getSnapshots() {
    return loadHistory().snapshots;
}

/**
 * Ambil array nilai dari symbol tertentu dari riwayat.
 * @param {string} symbol - Nama field (e.g. "VIX", "US10Y", "DXY")
 * @param {number} days - Jumlah hari ke belakang (default 20)
 * @returns {number[]} - Array nilai (terbaru di akhir)
 */
function getRecentValues(symbol, days = 20) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const snapshots = getSnapshots().filter(s =>
        new Date(s.timestamp).getTime() > cutoff && s[symbol] !== null && s[symbol] !== undefined
    );
    return snapshots.map(s => s[symbol]);
}

/**
 * Ambil snapshot N jam yang lalu (untuk Rate of Change).
 * @param {number} hoursAgo - Berapa jam ke belakang
 * @returns {object|null} - Snapshot terdekat
 */
function getSnapshotHoursAgo(hoursAgo) {
    const target = Date.now() - (hoursAgo * 60 * 60 * 1000);
    const snapshots = getSnapshots();

    if (snapshots.length === 0) return null;

    // Cari snapshot terdekat dengan target waktu
    let closest = snapshots[0];
    let closestDiff = Math.abs(new Date(closest.timestamp).getTime() - target);

    for (const s of snapshots) {
        const diff = Math.abs(new Date(s.timestamp).getTime() - target);
        if (diff < closestDiff) {
            closest = s;
            closestDiff = diff;
        }
    }

    // Hanya return jika selisih < 12 jam (toleransi)
    if (closestDiff < 12 * 60 * 60 * 1000) return closest;
    return null;
}

module.exports = { saveSnapshot, getSnapshots, getRecentValues, getSnapshotHoursAgo };
