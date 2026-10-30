# Files & folders

## The app's data folder

| Windows | Linux |
|---|---|
| `%APPDATA%\com.anas1412.backteststudio` | `~/.local/share/com.anas1412.backteststudio` |

```
workspace/                 where the AI works
  AGENTS.md                its instructions (CLAUDE.md and GEMINI.md point here)
  opencode.json            opencode's permissions
  strategies/<name>/       one folder per strategy: <name>.mq5 and tester.ini
  tools/                   the commands the AI may run, and the app's MQL5 helpers
    compile / backtest / live   (.cmd on Windows, .sh on Linux)
    include/               Risk.mqh, TimeZones.mqh (#include <Studio/...>)
    mql5/                  bar exporter, symbol reader, time-zone check
    check_timezones.py
  .studio/                 app state: conversations, settings, keys.json, chosen MT5 install, live state
runs/                      every backtest, one folder each
  <date>-<time>-<name>/    the code and tester.ini it ran with, MT5's report and log,
                           the daily rules log, the chart bars, result.json
```

The files under `tools/` and `AGENTS.md` belong to the app and are refreshed when it updates. Your strategies, runs,
conversations and keys are never touched by an update.

Back up the whole folder to keep everything; copy it to another computer to move everything (then pick the MT5 install
again in the app).

## Inside MetaTrader 5

MT5 only compiles and runs code inside its own `MQL5` folder, so the app **links** its folders there instead of copying
(junctions on Windows, no admin rights needed; symbolic links on Linux):

| In MT5's `MQL5` folder | Points to |
|---|---|
| `Experts/Studio` | `workspace/strategies` |
| `Experts/StudioTools`, `Scripts/StudioTools` | `workspace/tools/mql5` |
| `Include/Studio` | `workspace/tools/include` |

So your strategies also show up in MT5's Navigator under *Expert Advisors → Studio*, and you can open them in
MetaEditor. Live trading also writes the strategy's inputs as `MQL5/Presets/studio_<name>.set`.

The app runs MT5 in **portable mode** (`/portable`): MT5 keeps its data in its own install folder.
