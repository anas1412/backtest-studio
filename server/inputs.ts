// A strategy's own settings: the `input` lines of its .mq5 and of the studio
// includes it uses (<Studio/Risk.mqh>), with their `input group` and, for
// enums, the choices. Current values come from tester.ini [TesterInputs].
// The same values are used for backtests and, as a preset, for live trading.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STRATEGIES, TOOLS_INCLUDE } from "./paths";
import { parseIni, setKeys } from "./ini";

export type InputOption = { value: string; label: string };
export type StrategyInput = {
  name: string; type: string; default: string; comment: string; value: string;
  group: string; options?: InputOption[];
};

const INPUT_LINE = /^\s*s?input\s+(\w+)\s+(\w+)\s*=\s*([^;]+);\s*(?:\/\/\s*(.*))?$/;
const GROUP_LINE = /^\s*input\s+group\s+"([^"]*)"/;

// enum NAME { A = 0, // label ... } -> NAME -> [{ value, label, ident }]
function parseEnums(src: string) {
  const enums = new Map<string, (InputOption & { ident: string })[]>();
  for (const m of src.matchAll(/enum\s+(\w+)\s*\{([\s\S]*?)\}/g)) {
    let next = 0;
    const items: (InputOption & { ident: string })[] = [];
    for (const line of m[2].split(/\r?\n/)) {
      const it = line.match(/^\s*(\w+)\s*(?:=\s*(-?\d+))?\s*,?\s*(?:\/\/\s*(.*))?$/);
      if (!it) continue;
      const v = it[2] !== undefined ? Number(it[2]) : next;
      next = v + 1;
      items.push({ ident: it[1], value: String(v), label: (it[3] ?? it[1]).trim() });
    }
    enums.set(m[1], items);
  }
  return enums;
}

// A strategy's source with studio includes inlined where they appear,
// so groups keep the order the EA declares them in.
function expand(src: string): string {
  return src.replace(
    /^\s*#include\s*<Studio\/(\w+\.mqh)>.*$/gm,
    (line, file) => (existsSync(join(TOOLS_INCLUDE, file)) ? readFileSync(join(TOOLS_INCLUDE, file), "utf8") : line),
  );
}

export function getInputs(name: string): StrategyInput[] | null {
  if (!/^\w+$/.test(name) || !existsSync(join(STRATEGIES, name, `${name}.mq5`))) return null;
  const iniPath = join(STRATEGIES, name, "tester.ini");
  return parseInputs(readFileSync(join(STRATEGIES, name, `${name}.mq5`), "utf8"), existsSync(iniPath) ? readFileSync(iniPath, "utf8") : "");
}

// The inputs of a source file with the values of a tester.ini (a strategy's
// own, or the copies a run keeps).
export function parseInputs(source: string, testerIni: string): StrategyInput[] {
  const src = expand(source);
  const enums = parseEnums(src);
  const set = parseIni(testerIni).get("TesterInputs") ?? new Map();
  const out: StrategyInput[] = [];
  let group = "Strategy";
  for (const line of src.split(/\r?\n/)) {
    const g = line.match(GROUP_LINE);
    if (g) { group = g[1] || "Strategy"; continue; }
    const m = line.match(INPUT_LINE);
    if (!m) continue;
    const [, type, key, def, comment] = m;
    let dflt = def.trim().replace(/^"(.*)"$/, "$1");
    const options = enums.get(type);
    // enum defaults are identifiers in code but numbers in tester.ini and presets
    if (options) dflt = options.find((o) => o.ident === dflt)?.value ?? dflt;
    out.push({
      name: key, type, default: dflt, comment: (comment ?? "").trim(), group,
      // tester values may carry optimisation ranges: value||start||step||stop||Y
      value: (set.get(key) ?? dflt).split("||")[0],
      options: options?.map(({ value, label }) => ({ value, label })),
    });
  }
  return out;
}

// Writes values into [TesterInputs], keeping any optimisation range suffix.
export function saveInputs(name: string, values: Record<string, string>) {
  const known = new Map((getInputs(name) ?? []).map((i) => [i.name, i]));
  const f = join(STRATEGIES, name, "tester.ini");
  const text = existsSync(f) ? readFileSync(f, "utf8") : "[Tester]\n";
  const old = parseIni(text).get("TesterInputs") ?? new Map();
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!known.has(k) || /[\r\n;]/.test(String(v))) continue;
    const prev = old.get(k) ?? "";
    next[k] = String(v) + (prev.includes("||") ? prev.slice(prev.indexOf("||")) : "");
  }
  writeFileSync(f, setKeys(text, "TesterInputs", next));
}

// MT5 preset (.set) text for live trading: one Name=value per input.
export function presetText(inputs: StrategyInput[]): string {
  return inputs.map((i) => `${i.name}=${i.value}`).join("\r\n") + "\r\n";
}
