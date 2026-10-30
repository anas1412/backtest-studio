# First start

Three things to set up once: MetaTrader 5, the account, and an AI.

## 1. MetaTrader 5

Install MT5 from your broker's website, as you normally would. The app looks for it by itself.

### Windows

Install MT5 normally. The app finds installs under *Program Files* and *Program Files (x86)*, and installs MT5 recorded
in `%APPDATA%\MetaQuotes\Terminal`.

### Linux

MT5 is a Windows program, so it runs under [Wine](https://www.winehq.org) (install Wine from your distribution). Install
MT5 in a Wine prefix, for example `WINEPREFIX=~/.wine_mt5 wine mt5setup.exe` with your broker's installer, or in a
[Bottles](https://usebottles.com) bottle. The app looks in:

- `~/.wine*` (any prefix whose name starts with `.wine`)
- `~/.local/share/wineprefixes/*`
- `~/.local/share/bottles/bottles/*`
- `~/Games/*`

If your MT5 lives somewhere else, set `MT5_DIR` (the folder with `terminal64.exe`) and, on Linux, `WINEPREFIX`, before
starting the app.

## 2. The account

The app never asks for or sees your password. It uses the logins MT5 has already saved:

1. Open MT5 and log in: **File → Login to Trade Account**, tick **Save password**.
2. Close MT5.
3. In the app, click the **MT5** badge in the title bar. Pick the install and the account. Every account that install
   has logged into is listed; *Whatever MT5 last used* follows MT5's own choice.

Accounts whose last login failed (expired trial, wrong server) are marked, so you don't test on a dead account.

::: warning MT5 must be closed while the app uses it
Backtests and reading your broker's symbols start MT5 in the background. MT5 allows one running copy per install, so
while the MT5 window is open the badge says **MT5 open · close to test**. Close it and the badge turns to
**MT5 ready**.
:::

## 3. An AI

Click the model name next to **Send** in the chat. The app lists the AI tools it found on your computer (Claude Code,
opencode, Gemini CLI, Codex) and lets you add API keys. Pick one and a model. Details in
[AI engines & API keys](./ai-engines).

## 4. Your first strategy

Press **New strategy**, describe your idea in plain words (entries, exits, stops, filters) and tick
*Backtest it right away*. The AI writes the Expert Advisor, compiles it and runs the first backtest. Next:
[Strategies & chat](./strategies).
