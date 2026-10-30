// Run history on disk. The backtest CLI writes runs/<id>/ from Claude's
// process; this watches the folder and tells the pages when anything changes.
import { existsSync, readdirSync, readFileSync, writeFileSync, watch, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS, STRATEGIES } from "./paths";
import { broadcast } from "./events";
import { mt5Open, busyWith, compile, backtest } from "./mt5";
import { parseBars } from "./report";
import { parseIni, setKeys } from "./ini";

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
  const csv = read(join(dir, "bars.csv"));
  // 6th column is the bar's spread in points (bar exports from before it was added have none)
  const spreads = csv.split(/\r?\n/).slice(1).map((l) => l.split(",")[5]).filter((v) => v !== undefined && v !== "").map(Number);
  return {
    meta: JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")),
    ...JSON.parse(readFileSync(f, "utf8")),
    bars: csv ? parseBars(csv) : [],
    avgSpread: spreads.length ? Math.round((spreads.reduce((a, b) => a + b, 0) / spreads.length) * 10) / 10 : null,
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

// The strategy as it is now, which may differ from what an older run used.
export function getStrategyFiles(name: string) {
  if (!/^\w+$/.test(name) || !existsSync(join(STRATEGIES, name, `${name}.mq5`))) return null;
  return { source: read(join(STRATEGIES, name, `${name}.mq5`)), ini: read(join(STRATEGIES, name, "tester.ini")), log: "" };
}

export function listStrategies(): string[] {
  if (!existsSync(STRATEGIES)) return [];
  return readdirSync(STRATEGIES).filter((d) => /^\w+$/.test(d) && existsSync(join(STRATEGIES, d, `${d}.mq5`))).sort();
}

export function mt5State(): "ready" | "testing" | "symbols" | "gui-open" {
  // the studio's own terminal runs also show up as a terminal process
  const busy = busyWith();
  if (busy) return busy === "symbols" ? "symbols" : "testing";
  return mt5Open() ? "gui-open" : "ready";
}

// The [Tester] keys the settings bar edits. Everything else in tester.ini
// (inputs, comments) is Claude's and left alone.
export const SETTING_KEYS = ["Symbol", "Period", "Model", "FromDate", "ToDate", "Deposit", "Currency", "Leverage"] as const;

export function getSettings(name: string): Record<string, string> | null {
  const f = join(STRATEGIES, name, "tester.ini");
  if (!/^\w+$/.test(name) || !existsSync(f)) return null;
  const t = parseIni(readFileSync(f, "utf8")).get("Tester") ?? new Map();
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, t.get(k) ?? ""]));
}

function saveSettings(name: string, values: Record<string, string>) {
  const f = join(STRATEGIES, name, "tester.ini");
  const clean = Object.fromEntries(Object.entries(values)
    .filter(([k, v]) => (SETTING_KEYS as readonly string[]).includes(k) && /^[\w.:-]+$/.test(String(v))));
  writeFileSync(f, setKeys(readFileSync(f, "utf8"), "Tester", clean));
}

// Re-run from the UI. Preconditions answer right away; the run itself is
// reported through the runs watcher like any other.
export function rerun(name: string, settings?: Record<string, string>): string | null {
  if (!listStrategies().includes(name)) return "No such strategy";
  const state = mt5State();
  if (state === "testing" || state === "symbols") return "MT5 is busy, wait for it to finish";
  if (state === "gui-open") return "Close MetaTrader 5 first";
  if (settings) saveSettings(name, settings);
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
