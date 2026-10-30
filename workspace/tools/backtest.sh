#!/usr/bin/env bash
# Compile, then run strategies/<name>/tester.ini in the MT5 Strategy Tester.
exec bun "$(dirname "$(readlink -f "$0")")/../../server/cli.ts" backtest "$@"
