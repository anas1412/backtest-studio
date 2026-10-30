// Entry point for workspace/tools/*.sh, which is what Claude runs.
//   bun server/cli.ts compile <strategy>
//   bun server/cli.ts backtest <strategy>
import { compile, backtest } from "./mt5";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [cmd, name] = process.argv.slice(2);
if (!cmd || !name || !/^\w+$/.test(name)) {
  console.error("usage: compile|backtest <strategy_name>  (letters, digits, underscore)");
  process.exit(2);
}

if (cmd === "compile") {
  const r = await compile(`Studio/${name}/${name}.mq5`);
  console.log(r.output);
  console.log(r.ok ? "COMPILE OK" : "COMPILE FAILED");
  process.exit(r.ok ? 0 : 1);
}

if (cmd === "backtest") {
  const c = await compile(`Studio/${name}/${name}.mq5`);
  if (!c.ok) {
    console.log(c.output + "\nCOMPILE FAILED -- fix errors before backtesting");
    process.exit(1);
  }
  try {
    const { meta, dir, log } = await backtest(name);
    if (meta.status === "failed") {
      console.log(`BACKTEST FAILED: ${meta.error}`);
      console.log(log.split("\n").filter((l) => /error|failed|cannot|invalid/i.test(l)).slice(-15).join("\n"));
      process.exit(1);
    }
    const { summary, trades } = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
    const keys = ["Total Net Profit", "Profit Factor", "Expected Payoff", "Total Trades",
      "Profit Trades (% of total)", "Equity Drawdown Maximal", "Sharpe Ratio", "Recovery Factor", "History Quality"];
    console.log(`RUN ${meta.id}`);
    for (const k of keys) console.log(`${k}: ${summary[k] ?? "-"}`);
    console.log(`Matched trades: ${trades.length}`);
  } catch (e) {
    console.log(`BACKTEST REFUSED: ${(e as Error).message}`);
    process.exit(1);
  }
  process.exit(0);
}

console.error(`unknown command ${cmd}`);
process.exit(2);
