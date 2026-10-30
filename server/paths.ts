import { join, resolve } from "node:path";

export const IS_WINDOWS = process.platform === "win32";

// From source (`bun server/main.ts`) everything lives in the repo. The desktop
// app sets STUDIO_DATA (the user's app data folder: workspace, runs) and
// STUDIO_RESOURCES (the bundled web build and workspace template), since the
// program's own folder is read-only (AppImage, Program Files).
const SRC_ROOT = resolve(import.meta.dir, "..");
const RESOURCES = process.env.STUDIO_RESOURCES;
export const DATA_DIR = process.env.STUDIO_DATA ?? SRC_ROOT;

export const WORKSPACE = join(DATA_DIR, "workspace");
export const STRATEGIES = join(WORKSPACE, "strategies");
export const STUDIO_DIR = join(WORKSPACE, ".studio"); // app state: threads, settings, symbol cache, live
export const LIVE_FILE = join(STUDIO_DIR, "live.json");
export const TOOLS_MQL5 = join(WORKSPACE, "tools", "mql5");
export const TOOLS_INCLUDE = join(WORKSPACE, "tools", "include");
export const RUNS = join(DATA_DIR, "runs");
export const BARS_CACHE = join(RUNS, "_bars");
export const WEB_DIST = RESOURCES ? join(RESOURCES, "web") : join(SRC_ROOT, "web", "dist");
// the app-owned workspace files shipped with a release (null from source: the repo is the workspace)
export const TEMPLATE = RESOURCES ? join(RESOURCES, "workspace") : null;

// Where MT5 is and which account it uses: see install.ts (selectable in the app).
