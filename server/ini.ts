// Minimal tester.ini reader/writer. Comments are dropped on write; MT5 only
// needs the keys. Inline "; comment" after a value is stripped too, since the
// tester passes it through as part of the input value otherwise.

export type Ini = Map<string, Map<string, string>>;

export function parseIni(text: string): Ini {
  const ini: Ini = new Map();
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s;.*$/, "").trim();
    if (!line || line.startsWith(";")) continue;
    const head = line.match(/^\[(.+)\]$/);
    if (head) {
      section = head[1];
      if (!ini.has(section)) ini.set(section, new Map());
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    if (!ini.has(section)) ini.set(section, new Map());
    ini.get(section)!.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return ini;
}

export function writeIni(ini: Ini): string {
  const out: string[] = [];
  for (const [section, keys] of ini) {
    if (section) out.push(`[${section}]`);
    for (const [k, v] of keys) out.push(`${k}=${v}`);
    out.push("");
  }
  return out.join("\r\n");
}
