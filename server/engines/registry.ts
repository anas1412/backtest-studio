// All engines, their detection results (cached), and lookup.
import type { Engine, EngineStatus } from "./types";
import { claudeEngine } from "./claude";
import { geminiEngine } from "./gemini";
import { opencodeEngine } from "./opencode";
import { codexEngine } from "./codex";
import { apiEngine } from "./api";
import { PROVIDERS } from "../keys";

export const ENGINES: Engine[] = [
  claudeEngine, geminiEngine, opencodeEngine, codexEngine,
  ...PROVIDERS.map((p) => apiEngine(p.id)),
];

let cache: EngineStatus[] | null = null;
let scanning: Promise<EngineStatus[]> | null = null;

export async function engineStatuses(refresh = false): Promise<EngineStatus[]> {
  if (cache && !refresh) return cache;
  scanning ??= Promise.all(ENGINES.map((e) => e.detect().catch((err) => ({
    id: e.id, label: e.label, kind: e.kind, available: false, detail: String(err?.message ?? err), models: [], customModels: false,
  } as EngineStatus)))).then((s) => { cache = s; scanning = null; return s; });
  return scanning;
}

export const engine = (id: string) => ENGINES.find((e) => e.id === id) ?? null;
