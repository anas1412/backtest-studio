// Run history on disk. The backtest CLI writes runs/<id>/ from Claude's
// process; this watches the folder and tells the pages when anything changes.
import { existsSync, readdirSync, readFileSync, watch, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS, STRATEGIES } from "./paths";
import { broadcast } from "./events";
import { mt5Open, testing, compile, backtest } from "./mt5";
import { parseBars } from "./report";

const safe = (id: string) => /^[\w.-]+$/.test(id) && !id.startsWith("_");
const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : "");

export function listRuns() {
  if (!existsSync(RUNS)) return [];
  return readdirSync(RUNS).filter((d) => safe(d) && existsSync(join(RUNS, d, "meta.json")))
    .sort().reverse()
    .map((d) => {
      const meta = JSON.parse(readFileSync(join(RUNS, d, "meta.json"), "utf8"));
      const res = join(RUNS, d, "result.json");
      // headline numbers for the history list, without shipping every deal
      const s = existsSync(res) ? JSON.parse(readFileSync(res, "utf8")).summary : {};
      return {
        ...meta, net: s["Total Net Profit"], pf: s["Profit Factor"], trades: s["Total Trades"],
        win: s["Profit Trades (% of total)"], dd: s["Equity Drawdown Maximal"],
      };
    });
}

export function getRun(id: string) {
  if (!safe(id)) return null;
  const dir = join(RUNS, id);
  const f = join(dir, "result.json");
  if (!existsSync(f)) return null;
  return {
    meta: JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")),
    ...JSON.parse(readFileSync(f, "utf8")),
    bars: existsSync(join(dir, "bars.csv")) ? parseBars(readFileSync(join(dir, "bars.csv"), "utf8")) : [],
  };
}

export function getRunFiles(id: string) {
  if (!safe(id) || !existsSync(join(RUNS, id, "meta.json"))) return null;
  const meta = JSON.parse(readFileSync(join(RUNS, id, "meta.json"), "utf8"));
  return {
    source: read(join(RUNS, id, `${meta.strategy}.mq5`)),
    ini: read(join(RUNS, id, "tester.ini")),
    log: read(join(RUNS, id, "tester.log")),
  };
}

export function listStrategies(): string[] {
  if (!existsSync(STRATEGIES)) return [];
  return readdirSync(STRATEGIES).filter((d) => /^\w+$/.test(d) && existsSync(join(STRATEGIES, d, `${d}.mq5`))).sort();
}

export function mt5State(): "ready" | "testing" | "gui-open" {
  // the studio's own tester run also shows up as a terminal process
  if (testing()) return "testing";
  return mt5Open() ? "gui-open" : "ready";
}

// Re-run from the UI. Preconditions answer right away; the run itself is
// reported through the runs watcher like any other.
export function rerun(name: string): string | null {
  if (!listStrategies().includes(name)) return "No such strategy";
  const state = mt5State();
  if (state === "testing") return "A backtest is already running";
  if (state === "gui-open") return "Close MetaTrader 5 first";
  (async () => {
    const c = await compile(`Studio/${name}/${name}.mq5`);
    if (!c.ok) {
      broadcast("notice", { tone: "error", title: `${name} did not compile`, description: c.output.split("\n").slice(-3).join(" ") });
      return;
    }
    await backtest(name).catch((e) => broadcast("notice", { tone: "error", title: "Backtest refused", description: e.message }));
  })();
  return null;
}

export function startWatching() {
  mkdirSync(RUNS, { recursive: true });
  let timer: Timer | undefined;
  watch(RUNS, { recursive: true }, (_e, file) => {
    if (!file || !/meta\.json$/.test(String(file))) return;
    clearTimeout(timer);
    timer = setTimeout(() => broadcast("runs", listRuns()), 200);
  });
  let strategyTimer: Timer | undefined;
  watch(STRATEGIES, { recursive: true }, () => {
    clearTimeout(strategyTimer);
    strategyTimer = setTimeout(() => broadcast("strategies", listStrategies()), 300);
  });
  let last = mt5State();
  setInterval(() => {
    const now = mt5State();
    if (now !== last) broadcast("mt5", (last = now));
  }, 2000);
}
