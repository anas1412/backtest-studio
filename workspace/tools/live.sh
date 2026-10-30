#!/usr/bin/env bash
# Live trading in MT5: live start <name> | live stop | live status
# In the desktop app STUDIO_BIN is the app's own executable; from source it is Bun.
if [ -n "$STUDIO_BIN" ]; then exec "$STUDIO_BIN" cli live "$@"; fi
exec bun "$(dirname "$(readlink -f "$0")")/../../server/cli.ts" live "$@"
