// Links the studio's folders into an MT5 install's MQL5 tree, so MT5 sees
// the strategies and tools without copying. Junctions on Windows (no admin
// rights needed), symlinks elsewhere.
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { STRATEGIES, TOOLS_MQL5, TOOLS_INCLUDE, IS_WINDOWS } from "./paths";

const LINKS: [string, string][] = [
  ["MQL5/Experts/Studio", STRATEGIES],         // strategies Claude writes
  ["MQL5/Experts/StudioTools", TOOLS_MQL5],    // bar exporter
  ["MQL5/Scripts/StudioTools", TOOLS_MQL5],    // symbol list, time zone check (scripts must live here)
  ["MQL5/Include/Studio", TOOLS_INCLUDE],      // #include <Studio/...>
];

// Returns what it did, or throws if a real folder is in the way.
export function ensureLinks(mt5Dir: string): string[] {
  mkdirSync(STRATEGIES, { recursive: true });
  mkdirSync(join(mt5Dir, "MQL5", "Presets"), { recursive: true }); // live input presets
  const done: string[] = [];
  for (const [rel, target] of LINKS) {
    const at = join(mt5Dir, rel);
    mkdirSync(join(at, ".."), { recursive: true });
    const st = lstatSync(at, { throwIfNoEntry: false });
    if (st && !st.isSymbolicLink()) throw new Error(`${rel} exists in MT5 and is a real folder, not a link. Move it away first.`);
    if (st) rmSync(at);
    symlinkSync(target, at, IS_WINDOWS ? "junction" : "dir");
    done.push(`linked ${rel} -> ${target}`);
  }
  return done;
}

export const linked = (mt5Dir: string) => LINKS.every(([rel]) => existsSync(join(mt5Dir, rel)));
