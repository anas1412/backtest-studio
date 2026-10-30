@echo off
rem Compile, then run strategies/<name>/tester.ini in the MT5 Strategy Tester.
rem Windows twin of backtest.sh for agents that use cmd or PowerShell.
"%STUDIO_BIN%" cli backtest %*
