// Everything that differs between Linux (MT5 under Wine) and Windows
// (MT5 native): starting MT5 programs and finding or closing the terminal.
import { IS_WINDOWS } from "./paths";
import { mt5Dir, winePrefix } from "./install";

const env = () => ({ ...process.env, WINEPREFIX: winePrefix(), WINEDEBUG: "-all" });
const cmd = (exe: string, args: string[]) => (IS_WINDOWS ? [`${mt5Dir()}\\${exe}`, ...args] : ["wine", exe, ...args]);

// Runs an MT5 program in its folder and waits for it to exit.
export async function runMt5(exe: string, args: string[]): Promise<number> {
  const p = Bun.spawn(cmd(exe, args), { cwd: mt5Dir(), env: env(), stdout: "ignore", stderr: "ignore" });
  return p.exited;
}

// Starts an MT5 program that must outlive this process (live trading).
export function startMt5Detached(exe: string, args: string[]) {
  const c = cmd(exe, args);
  // setsid puts it in its own session, so stopping the studio or the CLI
  // that started it does not take the terminal down with it
  const full = IS_WINDOWS ? ["cmd", "/c", "start", '""', ...c] : ["setsid", "-f", ...c];
  Bun.spawnSync(full, { cwd: mt5Dir(), env: env(), stdout: "ignore", stderr: "ignore" });
}

export function terminalRunning(): boolean {
  if (IS_WINDOWS) {
    const out = Bun.spawnSync(["tasklist", "/FI", "IMAGENAME eq terminal64.exe", "/NH"]).stdout.toString();
    return /terminal64\.exe/i.test(out);
  }
  // the bracket keeps pgrep from matching its own command line
  return Bun.spawnSync(["pgrep", "-f", "terminal6[4].exe"]).exitCode === 0;
}

// Asks the terminal to close like the window's X button would (it saves
// its state); forces it if it is still there after the wait.
export async function closeTerminal(waitMs = 20_000) {
  if (IS_WINDOWS) Bun.spawnSync(["taskkill", "/IM", "terminal64.exe"]);
  else Bun.spawnSync(["wine", "taskkill", "/IM", "terminal64.exe"], { env: env(), stdout: "ignore", stderr: "ignore" });
  const until = Date.now() + waitMs;
  while (terminalRunning() && Date.now() < until) await Bun.sleep(500);
  if (terminalRunning()) killTerminal();
}

export function killTerminal() {
  if (IS_WINDOWS) Bun.spawnSync(["taskkill", "/F", "/IM", "terminal64.exe"]);
  else Bun.spawnSync(["pkill", "-f", "terminal6[4].exe"]);
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
