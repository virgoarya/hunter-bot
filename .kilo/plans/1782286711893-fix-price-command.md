# Fix /price command – provider merge logic

## Context
- `/price` Slack/Discord slash command calls `fetchMultiPrice` → `providerManager.fetchPrices`.
- `providerManager` only merges entries that have a numeric `price` field.
- Yahoo Finance and Stooq providers return `{ close, ... }` (no `price`).
- Consequently `merged` stays empty, `formatPriceTable` falls back to *"Harga pasar tidak tersedia."*.

## Decision
Update `services/providerManager.js` to treat `close` as a fallback price and always expose a `price` field in the merged result.

## Implementation Steps
1. **Edit `services/providerManager.js`**
   - Replace the merging loop (lines ~59‑63) with logic that:
     ```js
     for (const [sym, info] of Object.entries(data)) {
       if (info && !(sym in merged)) {
         const priceVal = Number.isFinite(info.price)
           ? info.price
           : Number.isFinite(info.close)
           ? info.close
           : undefined;
         if (priceVal !== undefined) {
           const mergedInfo = { ...info, source: name.charAt(0).toUpperCase() + name.slice(1) };
           mergedInfo.price = priceVal;
           merged[sym] = mergedInfo;
         }
       }
     }
     ```
   - This keeps existing fields (`close`, `previousClose`, `change`, etc.) and adds a guaranteed `price`.
2. **Stage and commit**
   ```bash
   git add services/providerManager.js
   git commit -m "Fix price command: merge provider data using close when price missing"
   ```
3. **Push** to the remote `origin` main branch:
   ```bash
   git push origin main
   ```
4. **Verification** (manual but documented for the implementer):
   - Run a node REPL or a small script that imports `fetchMultiPrice` and logs the result for default symbols.
   - Ensure the output contains `price` values and `formatPriceTable` returns a populated table.

## Risks & Mitigations
- **Risk:** Some future provider may return a non‑numeric `close`. Mitigation – we only merge when the derived `priceVal` is a finite number.
- **Risk:** Changing merge logic could affect callers expecting only the original fields. Mitigation – we preserve all original fields; only add/override `price` when necessary.
- **Risk:** Direct push to `main` bypasses code‑review. The user explicitly requested auto‑commit & push; ensure CI runs after push.

## Validation Checklist
- [ ] `services/providerManager.js` updated as described.
- [ ] Commit pushed to remote.
- [ ] `node -e "require('./services/marketPrice').fetchMultiPrice().then(console.log)"` prints objects with a `price` key.
- [ ] `formatPriceTable` no longer returns the fallback "Harga pasar tidak tersedia." for successful fetches.

---
*Plan ready for implementation.*