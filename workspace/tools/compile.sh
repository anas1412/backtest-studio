#!/usr/bin/env bash
# Compile workspace/strategies/<name>/<name>.mq5 with MetaEditor (Wine).
exec bun "$(dirname "$(readlink -f "$0")")/../../server/cli.ts" compile "$@"
