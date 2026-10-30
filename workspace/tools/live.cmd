@echo off
rem Live trading in MT5: live start <name> | live stop | live status
rem Windows twin of live.sh for agents that use cmd or PowerShell.
"%STUDIO_BIN%" cli live %*
