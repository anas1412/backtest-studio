#!/usr/bin/env bash
# Compile, then run strategies/<name>/tester.ini in the MT5 Strategy Tester.
# In the desktop app STUDIO_BIN is the app's own executable; from source it is Bun.
if [ -n "$STUDIO_BIN" ]; then exec "$STUDIO_BIN" cli backtest "$@"; fi
exec bun "$(dirname "$(readlink -f "$0")")/../../server/cli.ts" backtest "$@"
