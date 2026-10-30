# Install

Backtest Studio runs on **Windows 10/11** and **Linux** (64-bit). It drives the MetaTrader 5 you already have, so you
also need MT5 from your broker: see [First start](./first-start).

<script setup>
import { VPButton } from "vitepress/theme";
</script>

<div style="display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0">
  <VPButton tag="a" size="big" theme="brand" text="Download for Windows" href="https://github.com/anas1412/backtest-studio/releases/latest/download/BacktestStudio-Windows-Setup.exe" />
  <VPButton tag="a" size="big" theme="brand" text="Download for Linux" href="https://github.com/anas1412/backtest-studio/releases/latest/download/BacktestStudio-Linux.AppImage" />
</div>

Both always give the newest version. Release notes and older versions are on the
[releases page](https://github.com/anas1412/backtest-studio/releases).

### Windows

1. Download it with the **Windows** button above (`BacktestStudio-Windows-Setup.exe`).
2. Run it. Windows SmartScreen may say *"Windows protected your PC"*: the app isn't code-signed, so click
   **More info → Run anyway**.
3. Start Backtest Studio from the Start menu.

To uninstall: Settings → Apps → Backtest Studio.

### Linux

1. Download it with the **Linux** button above (`BacktestStudio-Linux.AppImage`).
2. Make it executable: `chmod +x BacktestStudio-Linux.AppImage`, or in your file manager Properties → Permissions →
   *Allow executing as a program*.
3. Open it.

It runs on distributions with glibc 2.35 or newer (most from 2022 on).

::: tip Linux: where to keep the AppImage
A downloaded file can't run until it's executable, and some file managers refuse to start it until then
("launching executables is not allowed"). Step 2 fixes that.

When the AppImage runs from somewhere other than `~/Applications` (your Downloads folder, say), the app offers once to
**move itself to `~/Applications`**, so it doesn't get deleted with your downloads. It also adds itself to your
desktop's app menu, with its icon. You can remove or re-add that entry later under *Engines & API keys* (the gear in
the title bar).
:::

## Updates

The app checks GitHub for a new version. When one is out, the version label in the title bar turns into
**Update x.y.z**: click it to read what's new, then **Restart to update**. Your strategies, chats, backtests and keys are
kept. Click the version label any time to check now.

The download picks the fastest of GitHub's servers for your connection and switches to another if it stalls. If an
update ever fails, download the new version from the releases page and install it over the old one: nothing is lost.

## Where your data lives

| | Windows | Linux |
|---|---|---|
| App data (strategies, chats, runs, keys) | `%APPDATA%\com.anas1412.backteststudio` | `~/.local/share/com.anas1412.backteststudio` |

Uninstalling the app leaves this folder; delete it to remove everything. More in [Files & folders](../reference/files).
