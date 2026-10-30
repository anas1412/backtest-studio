// Conversations: threads saved under workspace/.studio/, each message run by
// the engine picked in the composer (an agent CLI or the built-in API agent).
// CLIs keep their own session per thread; the API agent's history is stored
// here. One message runs at a time.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { STUDIO_DIR as DIR } from "./paths";
import { broadcast } from "./events";
import { engine, engineStatuses } from "./engines/registry";
import type { ChatEvent } from "./engines/types";

export type { ChatEvent };
export type ChatSettings = { engine: string; model: string; effort: string };

type Thread = {
  id: string; title: string; created: string;
  sessions?: Record<string, string>; // engine id -> that engine's session id
  sessionId?: string;                // before engines existed: a Claude session
};

const INDEX = join(DIR, "threads.json");
const SETTINGS = join(DIR, "chat-settings.json");
mkdirSync(join(DIR, "threads"), { recursive: true });

let threads: Thread[] = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : [];
const cache = new Map<string, ChatEvent[]>();
let busyThread: string | null = null;
let abort: AbortController | null = null;
const pendingConfirm = new Map<string, (answer: boolean) => void>();

// Passed explicitly on every call so no engine falls back to its own default model.
let settings: ChatSettings = { engine: "claude", model: "opus", effort: "high", ...(existsSync(SETTINGS) ? JSON.parse(readFileSync(SETTINGS, "utf8")) : {}) };

export const chatSettings = () => settings;
export async function setChatSettings(next: Partial<ChatSettings>): Promise<string | null> {
  const merged = { ...settings, ...next };
  const st = (await engineStatuses()).find((e) => e.id === merged.engine);
  if (!st?.available) return "That engine isn't available";
  if (!merged.model || !/^[\w.:/@#+-]+$/.test(merged.model)) return "Pick a model";
  if (!st.customModels && !st.models.some((m) => m.id === merged.model)) return "Unknown model for this engine";
  settings = merged;
  writeFileSync(SETTINGS, JSON.stringify(settings));
  broadcast("chat-settings", settings);
  return null;
}

const eventsFile = (id: string) => join(DIR, "threads", `${id}.json`);
const historyFile = (id: string) => join(DIR, "threads", `${id}.history.json`);
const saveIndex = () => writeFileSync(INDEX, JSON.stringify(threads, null, 2));
const safe = (id: string) => /^[\w-]+$/.test(id);

export const listThreads = () => threads.map(({ id, title, created }) => ({ id, title, created }));
export const busy = () => busyThread;

export function threadEvents(id: string): ChatEvent[] | null {
  if (!safe(id) || !threads.some((t) => t.id === id)) return null;
  if (!cache.has(id)) cache.set(id, existsSync(eventsFile(id)) ? JSON.parse(readFileSync(eventsFile(id), "utf8")) : []);
  return cache.get(id)!;
}

export function createThread() {
  const t: Thread = { id: crypto.randomUUID().slice(0, 8), title: "New conversation", created: new Date().toISOString() };
  threads.unshift(t);
  saveIndex();
  broadcast("threads", listThreads());
  return t;
}

export function deleteThread(id: string) {
  if (busyThread === id) abort?.abort();
  threads = threads.filter((t) => t.id !== id);
  cache.delete(id);
  rmSync(eventsFile(id), { force: true });
  rmSync(historyFile(id), { force: true });
  saveIndex();
  broadcast("threads", listThreads());
}

export function stop() {
  abort?.abort();
  for (const resolve of pendingConfirm.values()) resolve(false);
}

// The user's answer to a confirmation an engine asked for (e.g. start live).
export function answerConfirm(id: string, answer: boolean): boolean {
  const resolve = pendingConfirm.get(id);
  if (!resolve) return false;
  resolve(answer);
  return true;
}

export async function send(threadId: string, message: string) {
  const thread = threads.find((t) => t.id === threadId);
  const events = threadEvents(threadId);
  if (!thread || !events) throw new Error("No such thread");
  if (busyThread) throw new Error("Still working on the last message");
  const eng = engine(settings.engine);
  if (!eng) throw new Error("No engine selected");

  const flush = () => writeFileSync(eventsFile(threadId), JSON.stringify(events));
  const emit = (e: ChatEvent) => {
    // stored text is merged; the live stream gets every delta
    const last = events[events.length - 1];
    if (e.kind === "text" && last?.kind === "text") last.text += e.text;
    else events.push({ ...e });
    broadcast("chat", { threadId, event: e });
    if (e.kind !== "text") flush();
  };

  if (thread.title === "New conversation") {
    thread.title = message.length > 60 ? `${message.slice(0, 57)}…` : message;
    saveIndex();
    broadcast("threads", listThreads());
  }
  const { model, effort } = settings;
  emit({ kind: "user", text: message, engine: eng.id, model, effort });

  if (thread.sessionId) { // migrate the pre-engine field
    thread.sessions = { claude: thread.sessionId, ...thread.sessions };
    delete thread.sessionId;
  }
  busyThread = threadId;
  abort = new AbortController();
  broadcast("chat-busy", busyThread);
  try {
    await eng.send({
      message, model, effort: effort || undefined, signal: abort.signal, emit,
      session: thread.sessions?.[eng.id],
      setSession: (s) => { thread.sessions = { ...thread.sessions, [eng.id]: s }; saveIndex(); },
      history: existsSync(historyFile(threadId)) ? JSON.parse(readFileSync(historyFile(threadId), "utf8")) : [],
      setHistory: (h) => writeFileSync(historyFile(threadId), JSON.stringify(h)),
      confirm: (question) => new Promise<boolean>((resolve) => {
        const id = crypto.randomUUID().slice(0, 8);
        pendingConfirm.set(id, (answer) => {
          pendingConfirm.delete(id);
          emit({ kind: "confirm", id, question, answer });
          resolve(answer);
        });
        emit({ kind: "confirm", id, question });
      }),
    });
  } catch (e) {
    emit({ kind: "done", error: (e as Error).message });
  } finally {
    flush();
    abort = null;
    busyThread = null;
    broadcast("chat-busy", null);
  }
}
