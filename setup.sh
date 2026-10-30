#!/usr/bin/env bash
# One-time: link the studio folders into the MT5 tree.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MT5_DIR="${MT5_DIR:-$HOME/.wine_mt5/drive_c/Program Files/MetaTrader 5}"
EXPERTS="$MT5_DIR/MQL5/Experts"
ln -sfn "$HERE/workspace/strategies" "$EXPERTS/Studio"
ln -sfn "$HERE/workspace/tools/mql5" "$EXPERTS/StudioTools"
# scripts (StudioSymbols) must live under MQL5/Scripts to be started by the terminal
ln -sfn "$HERE/workspace/tools/mql5" "$MT5_DIR/MQL5/Scripts/StudioTools"
# shared includes for strategies: #include <Studio/TimeZones.mqh>
ln -sfn "$HERE/workspace/tools/include" "$MT5_DIR/MQL5/Include/Studio"
echo "Linked: $EXPERTS/Studio, $EXPERTS/StudioTools and MQL5/Scripts/StudioTools"
