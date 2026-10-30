#!/usr/bin/env bash
# One-time: link the studio folders into the MT5 tree.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MT5_DIR="${MT5_DIR:-$HOME/.wine_mt5/drive_c/Program Files/MetaTrader 5}"
EXPERTS="$MT5_DIR/MQL5/Experts"
ln -sfn "$HERE/workspace/strategies" "$EXPERTS/Studio"
ln -sfn "$HERE/workspace/tools/mql5" "$EXPERTS/StudioTools"
echo "Linked: $EXPERTS/Studio and $EXPERTS/StudioTools"
