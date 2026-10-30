# Changelog

New entries go under "Unreleased"; `scripts/release.sh` turns that into the
version being released. Each version's notes become its GitHub release notes
and what the app shows when it offers the update.

## Unreleased

- Export any backtest as a PDF report: summary, balance and drawdown charts, account rules check, detailed stats, monthly returns, price chart with the trades, the settings used and every trade; optionally the strategy's code. *Export PDF* next to the runs button.
- Linux: backtests asked for in the chat failed in the AppImage ("server/cli.ts isn't there"); the AI's commands now reach the app's runner.

## 0.1.3 — 2026-10-30

- Updates: a download that stops making progress for 30 seconds gives up and retries from another server, instead of hanging forever.

## 0.1.2 — 2026-10-30

- Linux: when the AppImage runs from somewhere other than `~/Applications` (Downloads, say), the app offers once to move itself there, so its app-menu entry keeps working.
- Settings: add or remove Backtest Studio from the app menu.

## 0.1.1 — 2026-10-30

- Custom title bar: MT5 status and account, live-trading pill, update check, settings and window buttons.
- The divider between chat and results can be dragged (or moved with the arrow keys); double-click resets it, dragging to the left edge hides the chat.
- The layout adapts to narrower windows.
- Linux: the app gets its icon and an app-menu entry.
- The "No strategies yet" screen is centred.

## 0.1.0 — 2026-10-30

First release.

- Chat with an AI on the left to write MQL5 strategies; chart, stats, trades and files on the right.
- Backtests run in your own MetaTrader 5 (Wine on Linux), with symbol, timeframe, dates, model and spread taken from your broker.
- Risk sizing and account rules (daily and max loss, profit target, trades per day) with a prop-firm check on every backtest.
- Go live on the account selected in MT5.
- AI engines: Claude Code, opencode, Gemini CLI, Codex, or an API key (Anthropic, OpenAI, Google, DeepSeek, OpenRouter, any OpenAI-compatible).
- Desktop app for Linux (AppImage) and Windows (installer) that updates itself, downloading from the fastest GitHub server.
