import { join, resolve } from "node:path";
import { homedir } from "node:os";

export const IS_WINDOWS = process.platform === "win32";

export const ROOT = resolve(import.meta.dir, "..");
export const WORKSPACE = join(ROOT, "workspace");
export const STRATEGIES = join(WORKSPACE, "strategies");
export const STUDIO_DIR = join(WORKSPACE, ".studio"); // app state: threads, settings, symbol cache, live
export const LIVE_FILE = join(STUDIO_DIR, "live.json");
export const TOOLS_MQL5 = join(WORKSPACE, "tools", "mql5");
export const TOOLS_INCLUDE = join(WORKSPACE, "tools", "include");
export const RUNS = join(ROOT, "runs");
export const BARS_CACHE = join(RUNS, "_bars");
export const WEB = join(ROOT, "web");

// Linux runs MT5 under Wine; Windows runs it directly. MT5 is used in
// portable mode, so its data lives in MT5_DIR either way. Override with
// MT5_DIR (and WINEPREFIX on Linux) for another install.
export const WINEPREFIX = process.env.WINEPREFIX ?? join(homedir(), ".wine_mt5");
export const MT5_DIR = process.env.MT5_DIR ?? (IS_WINDOWS
  ? join(process.env.ProgramFiles ?? "C:\\Program Files", "MetaTrader 5")
  : join(WINEPREFIX, "drive_c", "Program Files", "MetaTrader 5"));

// FILE_COMMON files: %APPDATA%\MetaQuotes\Terminal\Common\Files
export const COMMON_FILES = IS_WINDOWS
  ? join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "MetaQuotes", "Terminal", "Common", "Files")
  : join(WINEPREFIX, "drive_c", "users", process.env.USER ?? "", "AppData", "Roaming", "MetaQuotes", "Terminal", "Common", "Files");
