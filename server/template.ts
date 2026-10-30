// The desktop app ships the workspace's app-owned files (agent instructions,
// tool scripts, MQL5 includes and exporters). Each start copies them into the
// user's workspace, so an update brings new versions; the user's strategies
// and app state (.studio/) are never touched.
import { cpSync, existsSync, mkdirSync, chmodSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATE, WORKSPACE, STRATEGIES, IS_WINDOWS } from "./paths";

const OWNED = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", "opencode.json", "tools"];

export function syncTemplate() {
  mkdirSync(STRATEGIES, { recursive: true });
  if (!TEMPLATE) return;
  for (const name of OWNED) {
    const src = join(TEMPLATE, name);
    if (!existsSync(src)) continue;
    // compiled .ex5 files stay: MetaEditor rebuilds them when the source is newer
    cpSync(src, join(WORKSPACE, name), { recursive: true, force: true, filter: (f) => !/\.(ex5|log)$/.test(f) });
  }
  if (!IS_WINDOWS) {
    const tools = join(WORKSPACE, "tools");
    for (const f of readdirSync(tools)) if (f.endsWith(".sh")) chmodSync(join(tools, f), 0o755);
  }
}
