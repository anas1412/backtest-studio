#!/usr/bin/env bash
# Live trading in MT5: live.sh start <name> | stop | status
exec bun "$(dirname "$(readlink -f "$0")")/../../server/cli.ts" live "$@"
