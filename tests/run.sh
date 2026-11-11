#!/usr/bin/env bash
# Nöbet Defteri testleri: bash tests/run.sh [hizli|tam|fuzz N|batarya|ozellik|arayuz]
set -e
cd "$(dirname "$0")"
[ -d node_modules/jsdom ] || npm install --no-audit --no-fund >/dev/null
python3 -c "import playwright" 2>/dev/null || pip install --break-system-packages -q playwright >/dev/null
exec node run.js "${1:-hizli}" "${2:-}"
