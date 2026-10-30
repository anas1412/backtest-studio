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

// Changes keys in one section of a file someone else wrote (Claude), keeping
// its comments and order. Missing keys go at the end of the section.
export function setKeys(text: string, section: string, values: Record<string, string>): string {
  const lines = text.split(/\r?\n/);
  const todo = new Map(Object.entries(values));
  let current = "";
  let end = -1; // last line index inside the section
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].trim().match(/^\[(.+)\]$/);
    if (head) { current = head[1]; continue; }
    if (current !== section) continue;
    if (lines[i].trim()) end = i;
    const m = lines[i].match(/^(\s*)([^;=\s][^=]*?)(\s*=\s*)([^;]*?)(\s*;.*)?$/);
    if (m && todo.has(m[2])) {
      lines[i] = `${m[1]}${m[2]}${m[3]}${todo.get(m[2])}${m[5] ?? ""}`;
      todo.delete(m[2]);
    }
  }
  const extra = [...todo].map(([k, v]) => `${k}=${v}`);
  if (extra.length) {
    if (end < 0) lines.unshift(`[${section}]`, ...extra, "");
    else lines.splice(end + 1, 0, ...extra);
  }
  return lines.join("\n");
}
