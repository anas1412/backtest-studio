// API providers and the keys the user adds. Keys live only in
// workspace/.studio/keys.json (owner-only file), are never sent back to the
// browser (masked), never logged, and only sent to their own provider.
// Environment variables count too, so a key can also come from the shell.
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { STUDIO_DIR } from "./paths";

export type ProviderId = "anthropic" | "openai" | "google" | "deepseek" | "openrouter" | "compatible" | "ollama";
type Stored = { key?: string; baseURL?: string; label?: string };

export const PROVIDERS: { id: ProviderId; label: string; env?: string; needsKey: boolean; needsURL: boolean; defaultURL?: string; hint: string }[] = [
  { id: "anthropic", label: "Anthropic API", env: "ANTHROPIC_API_KEY", needsKey: true, needsURL: false, hint: "console.anthropic.com → API keys" },
  { id: "openai", label: "OpenAI API", env: "OPENAI_API_KEY", needsKey: true, needsURL: false, hint: "platform.openai.com → API keys" },
  { id: "google", label: "Gemini API", env: "GEMINI_API_KEY", needsKey: true, needsURL: false, hint: "aistudio.google.com → Get API key" },
  { id: "deepseek", label: "DeepSeek API", env: "DEEPSEEK_API_KEY", needsKey: true, needsURL: false, hint: "platform.deepseek.com → API keys" },
  { id: "openrouter", label: "OpenRouter", env: "OPENROUTER_API_KEY", needsKey: true, needsURL: false, hint: "openrouter.ai → Keys (one key, many models)" },
  { id: "compatible", label: "OpenAI-compatible", needsKey: false, needsURL: true, hint: "Any OpenAI-style API: Groq, Mistral, xAI, Together, LM Studio… (base URL ending in /v1)" },
  { id: "ollama", label: "Ollama (local)", needsKey: false, needsURL: true, defaultURL: "http://127.0.0.1:11434", hint: "Runs models on this machine: ollama.com" },
];

const FILE = join(STUDIO_DIR, "keys.json");
let store: Partial<Record<ProviderId, Stored>> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};

function save() {
  mkdirSync(STUDIO_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
  chmodSync(FILE, 0o600); // mode only applies when the file is created
}

const provider = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)!;

// What a provider call needs, from the file or the environment.
export function credentials(id: ProviderId): { key?: string; baseURL?: string } | null {
  const p = provider(id);
  const s = store[id] ?? {};
  const key = s.key || (p.env ? process.env[p.env] : undefined);
  const baseURL = s.baseURL || p.defaultURL;
  if (p.needsKey && !key) return null;
  if (p.needsURL && !baseURL) return null;
  return { key, baseURL };
}

const mask = (k?: string) => (k ? `${k.slice(0, 4)}…${k.slice(-4)}` : null);

export function publicView() {
  return PROVIDERS.map((p) => {
    const s = store[p.id] ?? {};
    const fromEnv = !s.key && !!(p.env && process.env[p.env]);
    return {
      ...p, configured: !!credentials(p.id),
      key: mask(s.key || (p.env ? process.env[p.env] : undefined)), fromEnv,
      baseURL: s.baseURL ?? p.defaultURL ?? null,
    };
  });
}

export function setProvider(id: ProviderId, v: { key?: string; baseURL?: string }): string | null {
  if (!PROVIDERS.some((p) => p.id === id)) return "Unknown provider";
  const next = { ...store[id] };
  if (v.key !== undefined) {
    const key = v.key.trim();
    if (key && !/^[\x21-\x7e]{8,300}$/.test(key)) return "That doesn't look like an API key";
    next.key = key || undefined;
  }
  if (v.baseURL !== undefined) {
    const u = v.baseURL.trim().replace(/\/+$/, "");
    if (u && !/^https?:\/\/[^\s]+$/.test(u)) return "Base URL must start with http:// or https://";
    next.baseURL = u || undefined;
  }
  store[id] = next;
  save();
  return null;
}

export function removeProvider(id: ProviderId) {
  delete store[id];
  save();
}

export type RemoteModel = { id: string; label: string };

// Lists the provider's chat models; doubles as the key test.
export async function listModels(id: ProviderId): Promise<RemoteModel[]> {
  const c = credentials(id);
  if (!c) throw new Error("No key or URL set");
  const get = async (url: string, headers: Record<string, string> = {}) => {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${(await r.text()).slice(0, 200)}`);
    return r.json() as Promise<any>;
  };
  const bearer = c.key ? { Authorization: `Bearer ${c.key}` } : {};
  switch (id) {
    case "anthropic": {
      const j = await get("https://api.anthropic.com/v1/models?limit=100", { "x-api-key": c.key!, "anthropic-version": "2023-06-01" });
      return j.data.map((m: any) => ({ id: m.id, label: m.display_name ?? m.id }));
    }
    case "openai": {
      const j = await get("https://api.openai.com/v1/models", bearer);
      return j.data.map((m: any) => m.id)
        .filter((m: string) => /^(gpt|o\d|chatgpt)/.test(m) && !/audio|realtime|tts|transcribe|image|embed|search|instruct/.test(m))
        .sort().map((m: string) => ({ id: m, label: m }));
    }
    case "google": {
      const j = await get("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { "x-goog-api-key": c.key! });
      return j.models.filter((m: any) => m.supportedGenerationMethods?.includes("generateContent") && /gemini/.test(m.name))
        .map((m: any) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName ?? m.name }));
    }
    case "deepseek": {
      const j = await get("https://api.deepseek.com/models", bearer);
      return j.data.map((m: any) => ({ id: m.id, label: m.id }));
    }
    case "openrouter": {
      await get("https://openrouter.ai/api/v1/key", bearer); // the model list is public; this checks the key
      const j = await get("https://openrouter.ai/api/v1/models");
      // the studio's agent needs tool calling
      return j.data.filter((m: any) => m.supported_parameters?.includes("tools"))
        .map((m: any) => ({ id: m.id, label: m.name ?? m.id }));
    }
    case "compatible": {
      const j = await get(`${c.baseURL}/models`, bearer);
      return (j.data ?? []).map((m: any) => ({ id: m.id, label: m.id }));
    }
    case "ollama": {
      const j = await get(`${c.baseURL}/api/tags`);
      return (j.models ?? []).map((m: any) => ({ id: m.name, label: m.name }));
    }
  }
}
