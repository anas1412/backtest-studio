# Troubleshooting

## "MT5 open · close to test"

The MetaTrader 5 window is open. MT5 allows one running copy per install, and the app needs to start its own for
backtests and for reading symbols. Close MT5 (all its windows) and the badge turns to **MT5 ready**.

To keep MT5 open for charting while you test, install MT5 a second time in another folder (on Linux, another Wine
prefix) and pick that install in the app.

## No MetaTrader 5 found

- **Windows:** install MT5 from your broker. If it's in an unusual place, start the app with `MT5_DIR` set to the
  folder that contains `terminal64.exe`.
- **Linux:** install MT5 inside a Wine prefix (`~/.wine*`, `~/.local/share/wineprefixes/*`), a Bottles bottle or
  `~/Games/*`. Otherwise start the app with `MT5_DIR=<folder with terminal64.exe>` and `WINEPREFIX=<its prefix>`. Wine
  must be installed from your distribution.

## The account is missing or its login fails

The app only lists accounts MT5 has logged into, with a saved password. Open MT5, **File → Login to Trade Account**,
tick **Save password**, log in, close MT5. An account marked as failed had its last login rejected: an expired demo or
trial, or the wrong server.

## A backtest fails

- **Compile errors:** the AI fixes them; ask it to. You can read them by running the compile command
  ([Commands](./commands)).
- **No history:** pick a range the broker has data for, or open the symbol's chart in MT5 once so it downloads history.
- **Symbol not found:** the symbol must exist on your broker exactly as written (`US100.cash`, `XAUUSD`…). Refresh the
  list with ↻ next to the symbol (MT5 closed).
- **0 trades:** the strategy never met its conditions, or every trade was skipped by risk sizing because it had no stop
  loss or the stop was too wide for the risk. Ask the AI why.

## The chat can't run backtests

Check that an engine is selected and signed in (*Engines & API keys*). If its answers mention a missing runner or
`cli.ts`, update the app: that was a bug in 0.1.3 and earlier on Linux.

## Updating fails or stalls

Download the latest version ([Windows](https://github.com/anas1412/backtest-studio/releases/latest/download/BacktestStudio-Windows-Setup.exe),
[Linux](https://github.com/anas1412/backtest-studio/releases/latest/download/BacktestStudio-Linux.AppImage)) and install it over the old one (Windows) or replace the AppImage (Linux). Your data is kept.

## Windows: "Windows protected your PC"

The installer isn't code-signed, so SmartScreen doesn't know it. Click **More info → Run anyway**.

## Linux: the AppImage doesn't open

- **Nothing happens, or "launching executables is not allowed":** the file isn't executable yet:
  `chmod +x BacktestStudio-Linux.AppImage`, or Properties → Permissions in your file manager.
- **An error mentions FUSE:** install your distribution's FUSE 2 package (often `libfuse2` or `fuse2`).
- **Anything else:** run it from a terminal to see the error, and
  [open an issue](https://github.com/anas1412/backtest-studio/issues) with it.
