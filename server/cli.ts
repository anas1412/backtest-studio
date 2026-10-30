// Entry point for workspace/tools/*.sh, which is what Claude runs.
//   bun server/cli.ts compile <strategy>
//   bun server/cli.ts backtest <strategy>
//   bun server/cli.ts live start <strategy> | live stop | live status
import { compile, backtest } from "./mt5";
import { startLive, stopLive, liveStatus, account } from "./live";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [cmd, a, b] = process.argv.slice(2);

if (cmd === "live") {
  if (a === "status" || !a) {
    const st = liveStatus();
    console.log(st ? `LIVE ${st.running ? "running" : "not running"}: ${st.strategy} on ${st.symbol} ${st.period}, account ${st.login} (${st.server}), since ${st.started}`
      : "No strategy is trading live.");
    process.exit(0);
  }
  if (a === "stop") {
    await stopLive();
    console.log("Live trading stopped. Open positions, if any, stay open in MT5.");
    process.exit(0);
  }
  if (a === "start" && b && /^\w+$/.test(b)) {
    const acc = account();
    const r = await startLive(b);
    if (r.error) { console.log(`NOT STARTED: ${r.error}`); process.exit(1); }
    console.log(`LIVE STARTED: ${b} on ${r.info!.symbol} ${r.info!.period}, account ${acc.login} (${acc.server}${acc.demo ? ", demo" : ", NOT a demo server"})`);
    process.exit(0);
  }
  console.error("usage: live start <strategy> | live stop | live status");
  process.exit(2);
}

const name = a;
if (!cmd || !name || !/^\w+$/.test(name)) {
  console.error("usage: compile|backtest <strategy_name>  (letters, digits, underscore) | live ...");
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
    const { summary, trades, prop } = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
    const keys = ["Total Net Profit", "Profit Factor", "Expected Payoff", "Total Trades",
      "Profit Trades (% of total)", "Equity Drawdown Maximal", "Sharpe Ratio", "Recovery Factor", "History Quality"];
    console.log(`RUN ${meta.id}`);
    for (const k of keys) console.log(`${k}: ${summary[k] ?? "-"}`);
    console.log(`Matched trades: ${trades.length}`);
    if (prop) {
      const r: string[] = [`Account rules: ${prop.passed ? "PASSED" : "BREACHED"}`];
      if (prop.daily) r.push(`daily loss worst ${prop.daily.worstPct.toFixed(2)}% of ${prop.daily.limitPct}% limit (${prop.daily.breaches.length} breach days)`);
      if (prop.maxLoss) r.push(`max loss worst ${prop.maxLoss.worstPct.toFixed(2)}% of ${prop.maxLoss.limitPct}%${prop.maxLoss.breachDay ? `, breached ${prop.maxLoss.breachDay}` : ""}`);
      if (prop.target) r.push(`target ${prop.target.pct}% ${prop.target.hitDay ? `reached ${prop.target.hitDay}` : "not reached"}`);
      console.log(r.join("; "));
    }
  } catch (e) {
    console.log(`BACKTEST REFUSED: ${(e as Error).message}`);
    process.exit(1);
  }
  process.exit(0);
}

console.error(`unknown command ${cmd}`);
process.exit(2);
