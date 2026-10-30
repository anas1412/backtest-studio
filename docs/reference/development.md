# Build from source

## Requirements

- [Bun](https://bun.sh) (a recent version).
- MetaTrader 5 (on Linux, in a Wine prefix).
- For the desktop app: Rust and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS
  (on Windows the Visual Studio C++ build tools and WebView2; on Linux WebKitGTK 4.1 and its development packages).

## Run it in the browser

The same commands on Windows (PowerShell) and Linux:

```sh
git clone https://github.com/anas1412/backtest-studio
cd backtest-studio
bun install
cd web; bun install; cd ..
bun run build:web          # the UI
bun setup.ts               # link the workspace into MT5
bun server/main.ts         # http://127.0.0.1:4747
```

From source, the repository *is* the workspace and data folder: strategies go in `workspace/strategies`, runs in
`runs/`. While working on the UI, run `bun run dev` in `web/` next to the server: `http://localhost:5747`, with hot reload.

## The desktop app

```sh
bun run tauri dev          # run the desktop app from source
bun run tauri build        # build the installer for this OS (Windows .exe, Linux AppImage)
```

The build compiles the server into one executable with `bun build --compile` (the *sidecar*) and wraps it, with the UI,
in a [Tauri](https://tauri.app) window. On start, the window shows a splash, starts the sidecar, and opens the UI when
the server reports its port.

## How it fits together

```
desktop/        Tauri app (Rust): window, updater, sidecar, Linux app-menu entry
server/         Bun server: MT5 control, backtests, reports, live trading, AI engines, chat
  engines/      one adapter per AI CLI, plus the built-in agent for API keys
web/            React UI (Vite, Tailwind, EasyUI components)
workspace/      what the AI sees: AGENTS.md, tools/, strategies/
docs/           this website (VitePress)
scripts/        sidecar build, release
```

- The **server** owns MT5: it runs one terminal at a time per install (a lock), writes the tester config, starts MT5 in
  portable mode, waits, and parses the HTML report and the daily log. Native on Windows, through Wine on Linux.
- The **UI** talks to the server over HTTP and gets live updates (MT5 state, backtest stages, chat) as server-sent
  events.
- **AI engines** run in `workspace/` with permissions limited to file edits and the three [commands](./commands).

## This website

```sh
cd docs
bun install
bun run docs:dev           # http://localhost:5173/backtest-studio/
```

Pushing changes under `docs/` (or to `CHANGELOG.md`) to `main` publishes the site to GitHub Pages.
