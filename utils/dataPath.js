/**
 * dataPath.js
 * Centralized data path resolver for all cache/data files.
 * 
 * In production (Railway), set DATA_DIR env to a persistent volume mount.
 * Locally, defaults to the project root directory.
 * 
 * Usage:
 *   const { resolveDataPath, resolveRootPath } = require("../utils/dataPath");
 *   const CACHE_FILE = resolveRootPath("twitter_cache.json");
 *   const HISTORY_FILE = resolveDataPath("macroHistory.json");
 */

const path = require("path");
const fs = require("fs");

// Project root = one level up from /utils
const PROJECT_ROOT = path.resolve(__dirname, "..");

// DATA_DIR: persistent storage for Railway Volumes or local ./data
const DATA_DIR = process.env.DATA_DIR || path.join(PROJECT_ROOT, "data");

// Ensure data directory exists at startup
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`📂 Created data directory: ${DATA_DIR}`);
}

/**
 * Resolve a filename inside the data directory.
 * E.g., resolveDataPath("macroHistory.json") => "/mount/data/macroHistory.json" (Railway)
 *        or "d:\...\data\macroHistory.json" (local)
 */
function resolveDataPath(filename) {
  return path.join(DATA_DIR, filename);
}

/**
 * Resolve a filename relative to the project root.
 * E.g., resolveRootPath("twitter_cache.json") => "d:\...\twitter_cache.json"
 * For files that live at project root level (not in /data).
 * In production these also go into DATA_DIR for persistence.
 */
function resolveRootPath(filename) {
  // In production, redirect root-level cache files to DATA_DIR too
  if (process.env.DATA_DIR) {
    return path.join(DATA_DIR, filename);
  }
  return path.join(PROJECT_ROOT, filename);
}

module.exports = { resolveDataPath, resolveRootPath, DATA_DIR, PROJECT_ROOT };
