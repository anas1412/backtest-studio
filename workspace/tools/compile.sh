#!/usr/bin/env bash
# Compile strategies/<name>/<name>.mq5 with MetaEditor.
# In the desktop app STUDIO_BIN is the app's own executable; from source it is Bun.
if [ -n "$STUDIO_BIN" ]; then exec "$STUDIO_BIN" cli compile "$@"; fi
exec bun "$(dirname "$(readlink -f "$0")")/../../server/cli.ts" compile "$@"
