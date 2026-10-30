# Backtest Studio

Describe a trading strategy in plain words; an AI writes it as an MQL5 Expert Advisor, compiles it and backtests it in
**your own MetaTrader 5**, and the results (chart, trades, stats, prop-firm rule check) appear next to the chat.
When a strategy is ready you can run it live in MT5 from the app.

- **Any AI:** Claude Code, opencode, Gemini CLI or Codex if installed, or an API key (Anthropic, OpenAI, Gemini,
  DeepSeek, OpenRouter, any OpenAI-compatible service, local Ollama).
- **Risk & rules** shared by every strategy: risk % per trade, daily and max loss limits (static or trailing), profit
  target, with a pass/fail check on every backtest — any prop firm is just a set of these values.
- **Linux and Windows.** On Linux MT5 runs under Wine.

## Install

Download the latest release from [Releases](https://github.com/anas1412/backtest-studio/releases/latest):

- **Linux:** `Backtest.Studio_<version>_amd64.AppImage` → make it executable (`chmod +x`) and run it.
- **Windows:** `Backtest.Studio_<version>_x64-setup.exe`. Windows warns about an unknown publisher (the app isn't
  code-signed): More info → Run anyway.

The app updates itself: when a new version is out it offers "Restart to update".

## First start

1. **MetaTrader 5:** install it from your broker and log in once with "Save password" ticked (on Linux, in a Wine
   prefix such as `~/.wine*` or Bottles). Click the MT5 badge in the app to pick the install and account.
2. **AI:** open the model picker next to Send → *Engines & API keys* to see what was found or to add a key.
3. Press **New strategy** and describe your idea.

Your data (strategies, chats, keys, runs) lives in `~/.local/share/com.anas1412.backteststudio` on Linux and
`%APPDATA%\com.anas1412.backteststudio` on Windows. API keys stay in that folder, readable only by your user.

## Build from source

Needs [Bun](https://bun.sh) and, for the desktop app, Rust and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
bun install && (cd web && bun install)
bun run build:web          # the UI
bun setup.ts               # link the workspace into MT5
bun server/main.ts         # http://127.0.0.1:4747
```

Desktop app: `bun run tauri dev`, or `bun run tauri build` for an installer of this OS.

## Releasing

`scripts/release.sh 0.2.0` sets the version, tags and pushes; the *Release* workflow builds the AppImage and the Windows
installer, signs them for the updater, and publishes them. The signing key is the repository secret
`TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`); keep a copy, without it installed apps can't take new updates.
