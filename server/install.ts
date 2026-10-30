// Which MetaTrader 5 the studio drives and with which account. Installs are
// found by scanning the usual places (Wine prefixes and Bottles on Linux,
// Program Files and MT5's own data folders on Windows). Accounts come from
// the install's journal: every login MT5 made there. The studio never sees
// passwords; it names the account in the start config and MT5 uses the one
// it saved.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { IS_WINDOWS, STUDIO_DIR } from "./paths";
import { ensureLinks } from "./links";

export type Install = { dir: string; prefix: string | null; name: string; portable: boolean };
export type Account = {
  login: string; server: string; lastSeen: string | null; current: boolean;
  failed: string | null; // reason, when MT5's last attempt to log in failed (expired trial, wrong server)
};
type Selection = { dir: string; prefix: string | null; login?: string; server?: string };

const FILE = join(STUDIO_DIR, "mt5.json");
const DEFAULT_PREFIX = process.env.WINEPREFIX ?? join(homedir(), ".wine_mt5");
const DEFAULT_DIR = process.env.MT5_DIR ?? (IS_WINDOWS
  ? join(process.env.ProgramFiles ?? "C:\\Program Files", "MetaTrader 5")
  : join(DEFAULT_PREFIX, "drive_c", "Program Files", "MetaTrader 5"));

export function utf16(path: string): string {
  const buf = readFileSync(path);
  return buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le").slice(1) : buf.toString("utf8");
}

const ls = (d: string) => { try { return readdirSync(d); } catch { return []; } };

let selection: Selection = existsSync(FILE)
  ? JSON.parse(readFileSync(FILE, "utf8"))
  : { dir: DEFAULT_DIR, prefix: IS_WINDOWS ? null : DEFAULT_PREFIX };

export const mt5Dir = () => selection.dir;
export const winePrefix = () => selection.prefix ?? DEFAULT_PREFIX;
export const selectedAccount = () => (selection.login ? { login: selection.login, server: selection.server ?? "" } : null);

// FILE_COMMON files: %APPDATA%\MetaQuotes\Terminal\Common\Files (inside the prefix on Linux)
export function commonFiles(): string {
  return IS_WINDOWS
    ? join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "MetaQuotes", "Terminal", "Common", "Files")
    : join(winePrefix(), "drive_c", "users", process.env.USER ?? "", "AppData", "Roaming", "MetaQuotes", "Terminal", "Common", "Files");
}

function installsIn(programFiles: string[], prefix: string | null): Install[] {
  return programFiles.flatMap((pf) => ls(pf).map((d) => join(pf, d)))
    .filter((dir) => existsSync(join(dir, "terminal64.exe")))
    .map((dir) => ({
      dir, prefix, name: basename(dir),
      // portable: MT5 keeps its data (MQL5, Config, Bases) in its own folder,
      // which is how the studio runs it
      portable: existsSync(join(dir, "MQL5")) && existsSync(join(dir, "Config")),
    }));
}

export function scanInstalls(): Install[] {
  let found: Install[] = [];
  if (IS_WINDOWS) {
    const pfs = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean) as string[];
    found = installsIn(pfs, null);
    // non-portable installs record where they live in their data folder
    const data = join(process.env.APPDATA ?? "", "MetaQuotes", "Terminal");
    for (const h of ls(data)) {
      const origin = join(data, h, "origin.txt");
      if (!existsSync(origin)) continue;
      const dir = utf16(origin).trim();
      if (existsSync(join(dir, "terminal64.exe"))) found.push({ dir, prefix: null, name: basename(dir), portable: false });
    }
  } else {
    const home = homedir();
    const prefixes = [
      ...ls(home).filter((d) => d.startsWith(".wine")).map((d) => join(home, d)),
      ...ls(join(home, ".local/share/wineprefixes")).map((d) => join(home, ".local/share/wineprefixes", d)),
      ...ls(join(home, ".local/share/bottles/bottles")).map((d) => join(home, ".local/share/bottles/bottles", d)),
      ...ls(join(home, "Games")).map((d) => join(home, "Games", d)),
    ];
    for (const p of prefixes) {
      found.push(...installsIn([join(p, "drive_c", "Program Files"), join(p, "drive_c", "Program Files (x86)")], p));
    }
  }
  if (existsSync(join(selection.dir, "terminal64.exe")) && !found.some((i) => i.dir === selection.dir)) {
    found.unshift({ dir: selection.dir, prefix: selection.prefix, name: basename(selection.dir), portable: existsSync(join(selection.dir, "MQL5")) });
  }
  const seen = new Set<string>();
  return found.filter((i) => !seen.has(i.dir) && seen.add(i.dir));
}

// The account MT5 itself last used (what it logs into when not told otherwise).
export function lastLogin(dir = selection.dir): { login: string; server: string } {
  const f = join(dir, "Config", "common.ini");
  const t = existsSync(f) ? utf16(f) : "";
  return { login: t.match(/^Login=(.+)$/m)?.[1].trim() ?? "", server: t.match(/^Server=(.+)$/m)?.[1].trim() ?? "" };
}

// Every account this install has logged into, newest first, from its journal.
export function accounts(dir = selection.dir): Account[] {
  const logs = join(dir, "logs");
  const seen = new Map<string, Account>();
  for (const f of ls(logs).filter((x) => /^\d{8}\.log$/.test(x)).sort()) {
    const day = `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`;
    // in order, so the last attempt per account wins
    for (const m of utf16(join(logs, f)).matchAll(/'(\d+)': (?:authorized on (.+?) through|authorization on (.+?) failed \((.+?)\))/g)) {
      const server = m[2] ?? m[3];
      const prev = seen.get(`${m[1]}@${server}`);
      seen.set(`${m[1]}@${server}`, {
        login: m[1], server, current: false, failed: m[2] ? null : m[4],
        lastSeen: m[2] ? day : prev?.lastSeen ?? null,
      });
    }
  }
  const sel = selectedAccount() ?? lastLogin(dir);
  if (sel.login && !seen.has(`${sel.login}@${sel.server}`)) {
    seen.set(`${sel.login}@${sel.server}`, { login: sel.login, server: sel.server, lastSeen: null, current: false, failed: null });
  }
  return [...seen.values()]
    .map((a) => ({ ...a, current: a.login === sel.login && a.server === sel.server }))
    .sort((a, b) => Number(b.current) - Number(a.current) || (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
}

export function select(next: { dir?: string; login?: string; server?: string }): string | null {
  const installs = scanInstalls();
  const inst = next.dir ? installs.find((i) => i.dir === next.dir) : installs.find((i) => i.dir === selection.dir);
  if (next.dir && !inst) return "No MT5 at that folder";
  const changingInstall = !!next.dir && next.dir !== selection.dir;
  selection = {
    dir: inst?.dir ?? selection.dir,
    prefix: inst?.prefix ?? selection.prefix,
    // a new install starts with whatever account it last used
    // an empty login means "whatever MT5 last used"
    login: changingInstall || next.login === "" ? undefined : next.login ?? selection.login,
    server: changingInstall || next.login === "" ? undefined : next.server ?? selection.server,
  };
  mkdirSync(STUDIO_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(selection, null, 2));
  if (changingInstall) {
    try { ensureLinks(selection.dir); } catch (e) { return (e as Error).message; }
  }
  return null;
}

// Prepends the chosen account to a terminal start config, so tests and live
// trading use it. MT5 supplies the saved password.
export function withAccount(iniText: string): string {
  const a = selectedAccount();
  return a ? `[Common]\r\nLogin=${a.login}\r\nServer=${a.server}\r\n\r\n${iniText}` : iniText;
}

// Reads what MT5 appends to today's journal from now on; used to catch a
// failed login while a terminal start is running.
export function journalWatch(): () => string {
  const logs = join(selection.dir, "logs");
  const latest = () => ls(logs).filter((x) => /^\d{8}\.log$/.test(x)).sort().pop();
  const startFile = latest();
  const startLen = startFile ? utf16(join(logs, startFile)).length : 0;
  return () => {
    const f = latest();
    if (!f) return "";
    const text = utf16(join(logs, f));
    return f === startFile ? text.slice(startLen) : text;
  };
}

export function loginFailure(text: string): string | null {
  const a = selectedAccount();
  const m = text.match(/'(\d+)': authorization on (.+?) failed \((.+?)\)/);
  if (!m || (a && m[1] !== a.login)) return null;
  return `MT5 couldn't log into ${m[1]} on ${m[2]}: ${m[3]}. Pick another account in the MT5 settings, or log into it once in MT5.`;
}
