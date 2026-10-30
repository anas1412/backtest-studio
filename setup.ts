// One-time setup, Linux or Windows: link the studio's folders into MT5.
//   bun setup.ts
// Uses the MT5 picked in the app, else MT5_DIR / WINEPREFIX, else the
// default location. Picking another install in the app links it by itself.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { mt5Dir } from "./server/install";
import { ensureLinks } from "./server/links";

const dir = mt5Dir();
if (!existsSync(join(dir, "terminal64.exe"))) {
  console.error(`No MT5 at ${dir}. Start the studio and pick your install, or set MT5_DIR.`);
  process.exit(1);
}
try {
  for (const line of ensureLinks(dir)) console.log(line);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
