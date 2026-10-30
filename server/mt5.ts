// Drives the MT5 install (Wine on Linux, native on Windows; see platform.ts):
// compile with MetaEditor, run the Strategy Tester headless, collect the
// report and the bars for the chart.
//
// Known quirks: MetaEditor needs a path relative
// to the terminal dir with cwd there, and returns 1 on a clean compile, so the
// log decides. Logs and reports are UTF-16LE. One terminal per data dir, so a
// run refuses to start while the MT5 GUI is open.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, statSync, readdirSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { STRATEGIES, RUNS, BARS_CACHE, TOOLS_MQL5, LIVE_FILE } from "./paths";
import { mt5Dir, commonFiles, withAccount, utf16, journalWatch, loginFailure } from "./install";
import { runMt5, terminalRunning, killTerminal, pidAlive } from "./platform";
import { parseIni, writeIni } from "./ini";
import { parseReport } from "./report";
import { propCheck } from "./prop";

const LOCK = join(RUNS, ".lock");
const BARS_FILE = "studio_bars.csv";
const DAILY_FILE = "studio_daily.csv"; // written by <Studio/Risk.mqh> in the tester

export { utf16 };

export const mt5Open = terminalRunning;

export async function compile(path: string, root = "MQL5/Experts"): Promise<{ ok: boolean; output: string }> {
  // path is relative to root, e.g. "Studio/ma_cross/ma_cross.mq5"
  const rel = `${root}/${path}`;
  const src = join(mt5Dir(), rel);
  if (!existsSync(src)) return { ok: false, output: `No source at ${rel}` };
  const log = src.replace(/\.mq5$/, ".log");
  rmSync(log, { force: true });
  await runMt5("MetaEditor64.exe", [`/compile:${rel.replaceAll("/", "\\")}`, "/log"]);
  if (!existsSync(log)) return { ok: false, output: "MetaEditor wrote no log -- it never ran or the path was wrong" };
  const lines = utf16(log).split(/\r?\n/).filter((l) => /error|warning|result/i.test(l));
  const result = lines.find((l) => /^result/i.test(l)) ?? "";
  return { ok: /\b0 errors?\b/i.test(result), output: lines.join("\n") };
}

export type LockPurpose = "backtest" | "symbols";

// What the studio is using MT5 for right now, or null. The lock holds the
// owner's pid, so a crashed run doesn't block the next one.
export function busyWith(): LockPurpose | null {
  if (!existsSync(LOCK)) return null;
  const [pid, purpose] = readFileSync(LOCK, "utf8").split(" ");
  if (!Number(pid) || !pidAlive(Number(pid))) return null;
  return purpose === "symbols" ? "symbols" : "backtest";
}
export const testing = () => busyWith() !== null;

export function lock(purpose: LockPurpose = "backtest"): boolean {
  mkdirSync(RUNS, { recursive: true });
  if (testing()) return false;
  rmSync(LOCK, { force: true });
  const fd = openSync(LOCK, "wx");
  writeFileSync(fd, `${process.pid} ${purpose}`);
  closeSync(fd);
  return true;
}

function runId(name: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${name}`;
}

export const unlock = () => rmSync(LOCK, { force: true });

// Starts the terminal with a config and waits for it to shut itself down.
// timeoutMs is a backstop for runs that can hang (no broker connection).
// A failed login (expired trial, wrong server) would leave the terminal
// waiting forever, so the journal is watched and the run stopped with the reason.
export async function runTerminal(iniText: string, timeoutMs?: number): Promise<void> {
  writeFileSync(join(mt5Dir(), "studio_run.ini"), withAccount(iniText));
  const fresh = journalWatch();
  let failure: string | null = null;
  const watch = setInterval(() => {
    failure = loginFailure(fresh());
    if (failure) killTerminal();
  }, 2000);
  const timer = timeoutMs ? setTimeout(killTerminal, timeoutMs) : undefined;
  try {
    await runMt5("terminal64.exe", ["/portable", "/config:studio_run.ini"]);
  } finally {
    clearInterval(watch);
    clearTimeout(timer);
  }
  failure ??= loginFailure(fresh());
  if (failure) throw new Error(failure);
}

function testerLogTail(since: number): string {
  // newest tester agent / terminal log written during this run
  const dirs = [join(mt5Dir(), "Tester", "logs"), join(mt5Dir(), "logs")];
  for (const d of readdirSync(join(mt5Dir(), "Tester"))) {
    if (d.startsWith("Agent-")) dirs.unshift(join(mt5Dir(), "Tester", d, "logs"));
  }
  const logs = dirs.flatMap((d) => existsSync(d) ? readdirSync(d).map((f) => join(d, f)) : [])
    .filter((f) => f.endsWith(".log") && statSync(f).mtimeMs >= since)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!logs.length) return "";
  return utf16(logs[0]).split(/\r?\n/).slice(-200).join("\n");
}

async function bars(tester: Map<string, string>): Promise<string | null> {
  const key = ["Symbol", "Period", "FromDate", "ToDate"].map((k) => tester.get(k) ?? "").join("_").replace(/[^\w.-]/g, "");
  const cached = join(BARS_CACHE, `v2_${key}.csv`);
  if (existsSync(cached)) return cached;
  // rebuild when missing or older than its source (the export format changes with it)
  const ex5 = join(mt5Dir(), "MQL5/Experts/StudioTools/StudioBars.ex5");
  if (!existsSync(ex5) || statSync(ex5).mtimeMs < statSync(join(TOOLS_MQL5, "StudioBars.mq5")).mtimeMs) {
    const c = await compile("StudioTools/StudioBars.mq5");
    if (!c.ok) return null;
  }
  const ini = parseIni("");
  ini.set("Tester", new Map([
    ["Expert", "StudioTools\\StudioBars"],
    ["Symbol", tester.get("Symbol") ?? ""],
    ["Period", tester.get("Period") ?? "H1"],
    ["Model", "2"], // open prices only: bars are historical, ticks buy nothing
    ["FromDate", tester.get("FromDate") ?? ""],
    ["ToDate", tester.get("ToDate") ?? ""],
    ["Deposit", tester.get("Deposit") ?? "10000"],
    ["Optimization", "0"], ["Visual", "0"], ["ShutdownTerminal", "1"],
  ]));
  const out = join(commonFiles(), BARS_FILE);
  rmSync(out, { force: true });
  await runTerminal(writeIni(ini));
  if (!existsSync(out)) return null;
  mkdirSync(BARS_CACHE, { recursive: true });
  copyFileSync(out, cached);
  return cached;
}

// compile happens before a run exists; these are the stages after it
export type Stage = "tester" | "report" | "bars";

export type Meta = {
  id: string; strategy: string; status: "running" | "done" | "failed"; stage?: Stage;
  started: string; finished?: string; error?: string; tester: Record<string, string>;
};

export async function backtest(name: string): Promise<{ meta: Meta; dir: string; log: string }> {
  const dir0 = join(STRATEGIES, name);
  const iniPath = join(dir0, "tester.ini");
  if (!existsSync(iniPath)) throw new Error(`No ${name}/tester.ini`);
  if (existsSync(LIVE_FILE) && mt5Open()) throw new Error("A strategy is trading live in MT5 -- stop it first (one terminal per data folder)");
  if (mt5Open()) throw new Error("MT5 is open -- close the MT5 terminal first (one terminal per data folder)");
  if (!lock()) throw new Error("Another backtest is running -- wait for it to finish");

  const id = runId(name);
  const dir = join(RUNS, id);
  mkdirSync(dir, { recursive: true });
  const ini = parseIni(readFileSync(iniPath, "utf8"));
  const tester = ini.get("Tester") ?? new Map();
  ini.set("Tester", tester);
  tester.set("Expert", `Studio\\${name}\\${name}`);
  tester.set("Report", "studio_report");
  tester.set("ReplaceReport", "1");
  tester.set("ShutdownTerminal", "1");
  tester.set("Optimization", "0");
  tester.set("Visual", "0");

  const meta: Meta = { id, strategy: name, status: "running", stage: "tester", started: new Date().toISOString(), tester: Object.fromEntries(tester) };
  const saveMeta = () => writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  saveMeta();
  copyFileSync(join(dir0, `${name}.mq5`), join(dir, `${name}.mq5`));
  copyFileSync(iniPath, join(dir, "tester.ini"));

  const report = join(mt5Dir(), "studio_report.htm");
  let log = "";
  try {
    rmSync(report, { force: true });
    rmSync(join(commonFiles(), DAILY_FILE), { force: true });
    const t0 = Date.now();
    await runTerminal(writeIni(ini));
    log = testerLogTail(t0);
    writeFileSync(join(dir, "tester.log"), log);
    if (!existsSync(report)) throw new Error("Tester produced no report -- see tester.log");
    meta.stage = "report";
    saveMeta();
    const html = utf16(report);
    writeFileSync(join(dir, "report.htm"), html);
    const daily = join(commonFiles(), DAILY_FILE);
    let prop = null;
    if (existsSync(daily)) {
      copyFileSync(daily, join(dir, "daily.csv"));
      prop = propCheck(readFileSync(daily, "latin1"));
    }
    writeFileSync(join(dir, "result.json"), JSON.stringify({ ...parseReport(html), prop }));
    meta.stage = "bars";
    saveMeta();
    const b = await bars(tester);
    if (b) copyFileSync(b, join(dir, "bars.csv"));
    meta.status = "done";
    delete meta.stage;
  } catch (e) {
    meta.status = "failed";
    meta.error = (e as Error).message;
  } finally {
    meta.finished = new Date().toISOString();
    saveMeta();
    unlock();
  }
  return { meta, dir, log };
}
