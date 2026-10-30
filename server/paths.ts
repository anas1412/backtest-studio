import { join, resolve } from "node:path";

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

// Where MT5 is and which account it uses: see install.ts (selectable in the app).
