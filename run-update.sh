#!/bin/bash

# Manual COT Mirror Update Script
# Run this locally (from your IP that can access both sources) to update mirrors

set -e

echo "🔄 Updating COT Mirrors..."
echo ""

# Update CFTC mirror
echo "📡 Updating CFTC mirror..."
node update-cot-mirrors.js --cftc-only

# Ask for MarketBull update
read -p "📊 Update MarketBull mirror? (requires non-blocked IP) [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    node update-cot-mirrors.js --marketbull
fi

# Ask for git push
read -p "📤 Push changes to remote? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add data/cot_raw.txt data/marketbull_cot.json
    git commit -m "update: COT mirrors - $(date +%Y-%m-%d)"
    git push origin main
    echo "✅ Pushed. Railway will auto-deploy."
fi

echo ""
echo "✅ Update complete!"
