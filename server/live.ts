// Live trading: start the MT5 terminal with one strategy attached to a chart
// and algo trading on, then leave it running on its own. Claude is not in the
// loop; MT5 runs the compiled EA. State lives in workspace/.studio/live.json.
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { LIVE_FILE } from "./paths";
import { mt5Dir, withAccount, selectedAccount, lastLogin, journalWatch, loginFailure } from "./install";
import { compile, busyWith, utf16 } from "./mt5";
import { startMt5Detached, terminalRunning, closeTerminal } from "./platform";
import { getInputs, presetText } from "./inputs";
import { getSettings } from "./runs";
import { writeIni, parseIni } from "./ini";

export type LiveInfo = {
  strategy: string; symbol: string; period: string; inputs: Record<string, string>;
  started: string; login: string; server: string;
};

// The account live trading will use: the one picked in the app, else MT5's last.
export function account(): { login: string; server: string; demo: boolean } {
  const { login, server } = selectedAccount() ?? lastLogin();
  return { login, server, demo: /demo|trial|sim/i.test(server) };
}

export function liveInfo(): LiveInfo | null {
  return existsSync(LIVE_FILE) ? JSON.parse(readFileSync(LIVE_FILE, "utf8")) : null;
}

// Live = we started it and the terminal is still there.
export function liveStatus(): (LiveInfo & { running: boolean }) | null {
  const info = liveInfo();
  if (!info) return null;
  return { ...info, running: terminalRunning() && !busyWith() };
}

export async function startLive(name: string): Promise<{ error?: string; info?: LiveInfo }> {
  const settings = getSettings(name);
  const inputs = getInputs(name);
  if (!settings || !inputs) return { error: "No such strategy" };
  if (busyWith()) return { error: "MT5 is busy with a backtest, wait for it to finish" };
  if (liveInfo()) await stopLive();
  if (terminalRunning()) return { error: "MetaTrader 5 is open. Close it first; the studio starts it with the strategy attached" };

  const c = await compile(`Studio/${name}/${name}.mq5`);
  if (!c.ok) return { error: `${name} did not compile:\n${c.output}` };

  // inputs as a preset; MT5 looks for it in MQL5/Presets
  mkdirSync(join(mt5Dir(), "MQL5", "Presets"), { recursive: true });
  const preset = `studio_${name}.set`;
  writeFileSync(join(mt5Dir(), "MQL5", "Presets", preset), presetText(inputs));

  const ini = parseIni("");
  // Enabled = the Algo Trading button; Account/Profile = 0 so it stays on
  ini.set("Experts", new Map([["AllowLiveTrading", "1"], ["AllowDllImport", "0"], ["Enabled", "1"], ["Account", "0"], ["Profile", "0"]]));
  ini.set("StartUp", new Map([
    ["Expert", `Studio\\${name}\\${name}`], ["ExpertParameters", preset],
    ["Symbol", settings.Symbol], ["Period", settings.Period],
  ]));
  writeFileSync(join(mt5Dir(), "studio_live.ini"), withAccount(writeIni(ini)));

  const { login, server } = account();
  const info: LiveInfo = {
    strategy: name, symbol: settings.Symbol, period: settings.Period,
    inputs: Object.fromEntries(inputs.map((i) => [i.name, i.value])),
    started: new Date().toISOString(), login, server,
  };
  mkdirSync(join(LIVE_FILE, ".."), { recursive: true });
  writeFileSync(LIVE_FILE, JSON.stringify(info, null, 2));
  const fresh = journalWatch();
  startMt5Detached("terminal64.exe", ["/portable", "/config:studio_live.ini"]);
  // give it time to log in; a failed login means nothing would ever trade
  for (let i = 0; i < 15; i++) {
    await Bun.sleep(2000);
    const text = fresh();
    const failure = loginFailure(text);
    if (failure) {
      await stopLive();
      return { error: failure };
    }
    if (/authorized on/.test(text)) break;
  }
  return { info };
}

// Closes the terminal, which stops the EA. Open positions stay open on the
// broker's side; close them in MT5 if needed.
export async function stopLive() {
  if (terminalRunning() && !busyWith()) await closeTerminal();
  rmSync(LIVE_FILE, { force: true });
}

// Recent terminal and EA journal lines, newest last.
export function liveLog(lines = 80): string[] {
  // MT5 names the EA log folder "logs" or "Logs" depending on version; Linux is case-sensitive
  const dirs = [join(mt5Dir(), "logs"), join(mt5Dir(), "MQL5", "logs"), join(mt5Dir(), "MQL5", "Logs")];
  const since = new Date(liveInfo()?.started ?? 0).getTime() - 60_000;
  const out: { t: number; line: string }[] = [];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    const latest = readdirSync(d).filter((f) => f.endsWith(".log")).map((f) => join(d, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    if (!latest || statSync(latest).mtimeMs < since) continue;
    utf16(latest).split(/\r?\n/).filter(Boolean).slice(-lines).forEach((line, i) => out.push({ t: i, line }));
  }
  // both journals start each line with a time; sort on it
  const time = (l: string) => l.match(/(\d{2}:\d{2}:\d{2}\.\d{3})/)?.[1] ?? "";
  return out.map((o) => o.line.replace(/^\w+\t\d+\t/, "")).sort((a, b) => time(a).localeCompare(time(b))).slice(-lines);
}
