// Named sets of "Risk & rules" values the user saves and reuses across
// strategies (one per prop account, say). Nothing is built in.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { STUDIO_DIR } from "./paths";

export type RuleProfile = { name: string; values: Record<string, string> };
const FILE = join(STUDIO_DIR, "rule-profiles.json");

export const listProfiles = (): RuleProfile[] => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);

function save(list: RuleProfile[]) {
  mkdirSync(STUDIO_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(list, null, 2));
}

export function putProfile(p: RuleProfile): string | null {
  const name = String(p?.name ?? "").trim();
  if (!name || name.length > 60) return "Give the profile a name (up to 60 characters)";
  const values = Object.fromEntries(Object.entries(p.values ?? {}).filter(([k, v]) => /^Inp\w+$/.test(k) && /^[\w.:-]*$/.test(String(v))));
  save([...listProfiles().filter((x) => x.name !== name), { name, values }].sort((a, b) => a.name.localeCompare(b.name)));
  return null;
}

export function deleteProfile(name: string) {
  save(listProfiles().filter((x) => x.name !== name));
}
