// Entry point for workspace/tools/*.sh, which is what agent CLIs run.
//   bun server/cli.ts compile <strategy>
//   bun server/cli.ts backtest <strategy>
//   bun server/cli.ts live start <strategy> | live stop | live status
import { compileStrategy, backtestStrategy, liveStatusText, liveStart, liveStop, type ActionResult } from "./actions";

const [cmd, a, b] = process.argv.slice(2);
const done = (r: ActionResult) => { console.log(r.text); process.exit(r.ok ? 0 : 1); };

if (cmd === "compile" && a) done(await compileStrategy(a));
else if (cmd === "backtest" && a) done(await backtestStrategy(a));
else if (cmd === "live" && (a === "status" || !a)) done(liveStatusText());
else if (cmd === "live" && a === "stop") done(await liveStop());
else if (cmd === "live" && a === "start" && b) done(await liveStart(b));
else {
  console.error("usage: compile <strategy> | backtest <strategy> | live start <strategy> | live stop | live status");
  process.exit(2);
}
