// Drives the Wine MT5 install: compile with MetaEditor, run the Strategy
// Tester headless, collect the report and the bars for the chart.
//
// Known quirks (from ~/orb/strategy/scripts): MetaEditor needs a path relative
// to the terminal dir with cwd there, and returns 1 on a clean compile, so the
// log decides. Logs and reports are UTF-16LE. One terminal per data dir, so a
// run refuses to start while the MT5 GUI is open.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, statSync, readdirSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { MT5_DIR, WINEPREFIX, STRATEGIES, RUNS, BARS_CACHE, COMMON_FILES } from "./paths";
import { parseIni, writeIni } from "./ini";
import { parseReport } from "./report";

const ENV = { ...process.env, WINEPREFIX, WINEDEBUG: "-all" };
const LOCK = join(RUNS, ".lock");
const BARS_FILE = "studio_bars.csv";

export function utf16(path: string): string {
  const buf = readFileSync(path);
  return buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le").slice(1) : buf.toString("utf8");
}

export function mt5Open(): boolean {
  // bracket keeps pgrep from matching its own command line
  return Bun.spawnSync(["pgrep", "-f", "terminal6[4].exe"]).exitCode === 0;
}

async function wine(args: string[]): Promise<number> {
  const p = Bun.spawn(["wine", ...args], { cwd: MT5_DIR, env: ENV, stdout: "ignore", stderr: "ignore" });
  return p.exited;
}

export async function compile(path: string): Promise<{ ok: boolean; output: string }> {
  // path is relative to MQL5/Experts, e.g. "Studio/ma_cross/ma_cross.mq5"
  const rel = `MQL5/Experts/${path}`;
  const src = join(MT5_DIR, rel);
  if (!existsSync(src)) return { ok: false, output: `No source at ${rel}` };
  const log = src.replace(/\.mq5$/, ".log");
  rmSync(log, { force: true });
  await wine(["MetaEditor64.exe", `/compile:${rel.replaceAll("/", "\\")}`, "/log"]);
  if (!existsSync(log)) return { ok: false, output: "MetaEditor wrote no log -- it never ran or the path was wrong" };
  const lines = utf16(log).split(/\r?\n/).filter((l) => /error|warning|result/i.test(l));
  const result = lines.find((l) => /^result/i.test(l)) ?? "";
  return { ok: /\b0 errors?\b/i.test(result), output: lines.join("\n") };
}

export function testing(): boolean {
  if (!existsSync(LOCK)) return false;
  const pid = Number(readFileSync(LOCK, "utf8"));
  return !!pid && Bun.spawnSync(["kill", "-0", String(pid)]).exitCode === 0;
}

function lock(): boolean {
  mkdirSync(RUNS, { recursive: true });
  if (testing()) return false;
  rmSync(LOCK, { force: true });
  const fd = openSync(LOCK, "wx");
  writeFileSync(fd, String(process.pid));
  closeSync(fd);
  return true;
}

function runId(name: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${name}`;
}

async function runTester(iniText: string): Promise<void> {
  writeFileSync(join(MT5_DIR, "studio_run.ini"), iniText);
  await wine(["terminal64.exe", "/portable", "/config:studio_run.ini"]);
}

function testerLogTail(since: number): string {
  // newest tester agent / terminal log written during this run
  const dirs = [join(MT5_DIR, "Tester", "logs"), join(MT5_DIR, "logs")];
  for (const d of readdirSync(join(MT5_DIR, "Tester"))) {
    if (d.startsWith("Agent-")) dirs.unshift(join(MT5_DIR, "Tester", d, "logs"));
  }
  const logs = dirs.flatMap((d) => existsSync(d) ? readdirSync(d).map((f) => join(d, f)) : [])
    .filter((f) => f.endsWith(".log") && statSync(f).mtimeMs >= since)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!logs.length) return "";
  return utf16(logs[0]).split(/\r?\n/).slice(-200).join("\n");
}

async function bars(tester: Map<string, string>): Promise<string | null> {
  const key = ["Symbol", "Period", "FromDate", "ToDate"].map((k) => tester.get(k) ?? "").join("_").replace(/[^\w.-]/g, "");
  const cached = join(BARS_CACHE, `${key}.csv`);
  if (existsSync(cached)) return cached;
  if (!existsSync(join(MT5_DIR, "MQL5/Experts/StudioTools/StudioBars.ex5"))) {
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
  const out = join(COMMON_FILES, BARS_FILE);
  rmSync(out, { force: true });
  await runTester(writeIni(ini));
  if (!existsSync(out)) return null;
  mkdirSync(BARS_CACHE, { recursive: true });
  copyFileSync(out, cached);
  return cached;
}

export type Meta = {
  id: string; strategy: string; status: "running" | "done" | "failed";
  started: string; finished?: string; error?: string; tester: Record<string, string>;
};

export async function backtest(name: string): Promise<{ meta: Meta; dir: string; log: string }> {
  const dir0 = join(STRATEGIES, name);
  const iniPath = join(dir0, "tester.ini");
  if (!existsSync(iniPath)) throw new Error(`No ${name}/tester.ini`);
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

  const meta: Meta = { id, strategy: name, status: "running", started: new Date().toISOString(), tester: Object.fromEntries(tester) };
  const saveMeta = () => writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  saveMeta();
  copyFileSync(join(dir0, `${name}.mq5`), join(dir, `${name}.mq5`));
  copyFileSync(iniPath, join(dir, "tester.ini"));

  const report = join(MT5_DIR, "studio_report.htm");
  let log = "";
  try {
    rmSync(report, { force: true });
    const t0 = Date.now();
    await runTester(writeIni(ini));
    log = testerLogTail(t0);
    writeFileSync(join(dir, "tester.log"), log);
    if (!existsSync(report)) throw new Error("Tester produced no report -- see tester.log");
    const html = utf16(report);
    writeFileSync(join(dir, "report.htm"), html);
    writeFileSync(join(dir, "result.json"), JSON.stringify(parseReport(html)));
    const b = await bars(tester);
    if (b) copyFileSync(b, join(dir, "bars.csv"));
    meta.status = "done";
  } catch (e) {
    meta.status = "failed";
    meta.error = (e as Error).message;
  } finally {
    meta.finished = new Date().toISOString();
    saveMeta();
    rmSync(LOCK, { force: true });
  }
  return { meta, dir, log };
}
