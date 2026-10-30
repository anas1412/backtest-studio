// The studio's actions as plain text results, shared by the CLI scripts
// (tools/*.sh, run by agent CLIs) and the built-in API agent's tools, so
// every engine sees the same output (including the "RUN <id>" line the chat
// turns into a run card).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile, backtest } from "./mt5";
import { startLive, stopLive, liveStatus, account } from "./live";

export type ActionResult = { ok: boolean; text: string };
const valid = (name: string) => /^\w+$/.test(name);

export async function compileStrategy(name: string): Promise<ActionResult> {
  if (!valid(name)) return { ok: false, text: "Strategy names use letters, digits and underscores only" };
  const r = await compile(`Studio/${name}/${name}.mq5`);
  return { ok: r.ok, text: `${r.output}\n${r.ok ? "COMPILE OK" : "COMPILE FAILED"}` };
}

export async function backtestStrategy(name: string): Promise<ActionResult> {
  const c = await compileStrategy(name);
  if (!c.ok) return { ok: false, text: `${c.text} -- fix errors before backtesting` };
  try {
    const { meta, dir, log } = await backtest(name);
    if (meta.status === "failed") {
      return { ok: false, text: `BACKTEST FAILED: ${meta.error}\n${log.split("\n").filter((l) => /error|failed|cannot|invalid/i.test(l)).slice(-15).join("\n")}` };
    }
    const { summary, trades, prop } = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
    const keys = ["Total Net Profit", "Profit Factor", "Expected Payoff", "Total Trades",
      "Profit Trades (% of total)", "Equity Drawdown Maximal", "Sharpe Ratio", "Recovery Factor", "History Quality"];
    const out = [`RUN ${meta.id}`, ...keys.map((k) => `${k}: ${summary[k] ?? "-"}`), `Matched trades: ${trades.length}`];
    if (prop) {
      const r: string[] = [`Account rules: ${prop.passed ? "PASSED" : "BREACHED"}`];
      if (prop.daily) r.push(`daily loss worst ${prop.daily.worstPct.toFixed(2)}% of ${prop.daily.limitPct}% limit (${prop.daily.breaches.length} breach days)`);
      if (prop.maxLoss) r.push(`max loss worst ${prop.maxLoss.worstPct.toFixed(2)}% of ${prop.maxLoss.limitPct}%${prop.maxLoss.breachDay ? `, breached ${prop.maxLoss.breachDay}` : ""}`);
      if (prop.target) r.push(`target ${prop.target.pct}% ${prop.target.hitDay ? `reached ${prop.target.hitDay}` : "not reached"}`);
      out.push(r.join("; "));
    }
    return { ok: true, text: out.join("\n") };
  } catch (e) {
    return { ok: false, text: `BACKTEST REFUSED: ${(e as Error).message}` };
  }
}

export function liveStatusText(): ActionResult {
  const st = liveStatus();
  return {
    ok: true,
    text: st ? `LIVE ${st.running ? "running" : "not running"}: ${st.strategy} on ${st.symbol} ${st.period}, account ${st.login} (${st.server}), since ${st.started}`
      : "No strategy is trading live.",
  };
}

export async function liveStart(name: string): Promise<ActionResult> {
  if (!valid(name)) return { ok: false, text: "Strategy names use letters, digits and underscores only" };
  const acc = account();
  const r = await startLive(name);
  if (r.error) return { ok: false, text: `NOT STARTED: ${r.error}` };
  return { ok: true, text: `LIVE STARTED: ${name} on ${r.info!.symbol} ${r.info!.period}, account ${acc.login} (${acc.server}${acc.demo ? ", demo" : ", NOT a demo server"})` };
}

export async function liveStop(): Promise<ActionResult> {
  await stopLive();
  return { ok: true, text: "Live trading stopped. Open positions, if any, stay open in MT5." };
}
