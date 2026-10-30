// One-time setup, Linux or Windows: link the studio's folders into MT5.
//   bun setup.ts            (set MT5_DIR / WINEPREFIX first for a non-default install)
// Windows gets directory junctions, which need no admin rights.
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { MT5_DIR, STRATEGIES, TOOLS_MQL5, TOOLS_INCLUDE, IS_WINDOWS } from "./server/paths";

if (!existsSync(join(MT5_DIR, "terminal64.exe"))) {
  console.error(`No MT5 at ${MT5_DIR}. Set MT5_DIR to your MetaTrader 5 folder (run it once in portable mode).`);
  process.exit(1);
}

const links: [string, string][] = [
  ["MQL5/Experts/Studio", STRATEGIES],           // strategies Claude writes
  ["MQL5/Experts/StudioTools", TOOLS_MQL5],      // bar exporter
  ["MQL5/Scripts/StudioTools", TOOLS_MQL5],      // symbol list, time zone check (scripts must live here)
  ["MQL5/Include/Studio", TOOLS_INCLUDE],        // #include <Studio/TimeZones.mqh>
];
mkdirSync(STRATEGIES, { recursive: true });
mkdirSync(join(MT5_DIR, "MQL5", "Presets"), { recursive: true }); // live input presets

for (const [rel, target] of links) {
  const at = join(MT5_DIR, rel);
  mkdirSync(join(at, ".."), { recursive: true });
  if (existsSync(at) || lstatSync(at, { throwIfNoEntry: false })) {
    if (!lstatSync(at).isSymbolicLink()) {
      console.error(`${rel} exists and is a real folder, not a link. Move it away and run again.`);
      process.exit(1);
    }
    rmSync(at);
  }
  symlinkSync(target, at, IS_WINDOWS ? "junction" : "dir");
  console.log(`linked ${rel} -> ${target}`);
}
