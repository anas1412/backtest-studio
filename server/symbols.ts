// Symbols the broker offers, read from MT5 itself by the StudioSymbols
// script (live spread included), plus which of them have downloaded
// history on disk. Cached in workspace/.studio/symbols.json.
import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { MT5_DIR, COMMON_FILES, STUDIO_DIR } from "./paths";
import { compile, lock, unlock, runTerminal, mt5Open, utf16 } from "./mt5";
import { parseIni, writeIni } from "./ini";

export type SymbolInfo = {
  name: string; description: string; path: string; digits: number;
  spread: number | null;           // live spread in points when the list was read
  history: [number, number] | null; // first and last year of downloaded M1 history
};
export type SymbolList = { server: string; refreshed: string | null; symbols: SymbolInfo[] };

const CACHE = join(STUDIO_DIR, "symbols.json");
const OUT = join(COMMON_FILES, "studio_symbols.tsv");

export function currentServer(): string {
  const f = join(MT5_DIR, "Config", "common.ini");
  return existsSync(f) ? (utf16(f).match(/^Server=(.+)$/m)?.[1].trim() ?? "") : "";
}

function historyYears(server: string): Map<string, [number, number]> {
  const dir = join(MT5_DIR, "Bases", server, "history");
  const out = new Map<string, [number, number]>();
  if (!server || !existsSync(dir)) return out;
  for (const sym of readdirSync(dir)) {
    const years = readdirSync(join(dir, sym)).map((f) => Number(f.match(/^(\d{4})\.hcc$/)?.[1])).filter(Boolean);
    if (years.length) out.set(sym, [Math.min(...years), Math.max(...years)]);
  }
  return out;
}

// History symbols first, then the rest of the broker list by name.
export function listSymbols(): SymbolList {
  const server = currentServer();
  const hist = historyYears(server);
  const cached: SymbolList | null = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : null;
  const base = cached?.server === server ? cached.symbols
    : [...hist.keys()].map((name) => ({ name, description: "", path: "", digits: 0, spread: null, history: null }));
  const symbols = base.map((s) => ({ ...s, history: hist.get(s.name) ?? null }))
    .sort((a, b) => Number(!!b.history) - Number(!!a.history) || a.name.localeCompare(b.name));
  return { server, refreshed: cached?.server === server ? cached.refreshed : null, symbols };
}

// Starts the terminal with the script; MT5 must be closed, like a backtest.
export async function refreshSymbols(): Promise<string | null> {
  if (mt5Open()) return "Close MetaTrader 5 first";
  if (!lock("symbols")) return "MT5 is busy with a backtest";
  try {
    if (!existsSync(join(MT5_DIR, "MQL5/Scripts/StudioTools/StudioSymbols.ex5"))) {
      const c = await compile("StudioTools/StudioSymbols.mq5", "MQL5/Scripts");
      if (!c.ok) return `StudioSymbols did not compile: ${c.output}`;
    }
    const ini = parseIni("");
    const first = listSymbols().symbols[0]?.name ?? "EURUSD";
    ini.set("StartUp", new Map([
      ["Script", "StudioTools\\StudioSymbols"], ["Symbol", first], ["Period", "H1"], ["ShutdownTerminal", "1"],
    ]));
    rmSync(OUT, { force: true });
    await runTerminal(writeIni(ini), 90_000);
    if (!existsSync(OUT)) return "MT5 did not write the symbol list (no broker connection?)";

    const rows = readFileSync(OUT, "latin1").split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split("\t"));
    const symbols: SymbolInfo[] = rows.map(([name, description, path, digits, spread, connected]) => ({
      name, description, path, digits: Number(digits),
      spread: connected === "1" && Number(spread) > 0 ? Number(spread) : null,
      history: null,
    }));
    writeFileSync(CACHE, JSON.stringify({ server: currentServer(), refreshed: new Date().toISOString(), symbols }));
    return null;
  } finally {
    unlock();
  }
}
