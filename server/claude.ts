// Runs `claude -p` in workspace/ and turns its stream-json output into chat
// events. Conversations are threads saved under workspace/.studio/, each
// resumed by its Claude session id. One message runs at a time.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Subprocess } from "bun";
import { WORKSPACE, STUDIO_DIR as DIR } from "./paths";
import { broadcast } from "./events";

const INDEX = join(DIR, "threads.json");
const SETTINGS = join(DIR, "chat-settings.json");
const ALLOWED = [
  "Read", "Write", "Edit", "Glob", "Grep",
  "Bash(tools/compile.sh:*)", "Bash(./tools/compile.sh:*)",
  "Bash(tools/backtest.sh:*)", "Bash(./tools/backtest.sh:*)",
  "Bash(tools/live.sh:*)", "Bash(./tools/live.sh:*)",
];

export const MODELS = ["opus", "sonnet", "haiku", "fable"] as const;
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type ChatSettings = { model: (typeof MODELS)[number]; effort: (typeof EFFORTS)[number] };

export type ChatEvent =
  | { kind: "user"; text: string; model?: string; effort?: string }
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; input: unknown }
  | { kind: "tool_result"; id: string; output: string; error: boolean }
  | { kind: "done"; cost?: number; error?: string };

type Thread = { id: string; title: string; created: string; sessionId?: string };

mkdirSync(join(DIR, "threads"), { recursive: true });
let threads: Thread[] = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : [];
const cache = new Map<string, ChatEvent[]>();
let proc: Subprocess | null = null;
// Passed explicitly on every call so the studio never inherits the CLI's own
// default model (which may be a small one).
let settings: ChatSettings = existsSync(SETTINGS)
  ? JSON.parse(readFileSync(SETTINGS, "utf8"))
  : { model: "opus", effort: "high" };

export const chatSettings = () => settings;
export function setChatSettings(next: Partial<ChatSettings>): string | null {
  if (next.model && !MODELS.includes(next.model)) return "Unknown model";
  if (next.effort && !EFFORTS.includes(next.effort)) return "Unknown effort";
  settings = { ...settings, ...next };
  writeFileSync(SETTINGS, JSON.stringify(settings));
  broadcast("chat-settings", settings);
  return null;
}
let busyThread: string | null = null;

const eventsFile = (id: string) => join(DIR, "threads", `${id}.json`);
const saveIndex = () => writeFileSync(INDEX, JSON.stringify(threads, null, 2));
const safe = (id: string) => /^[\w-]+$/.test(id);

export const listThreads = () => threads.map(({ sessionId: _, ...t }) => t);
export const busy = () => busyThread;

export function threadEvents(id: string): ChatEvent[] | null {
  if (!safe(id) || !threads.some((t) => t.id === id)) return null;
  if (!cache.has(id)) cache.set(id, existsSync(eventsFile(id)) ? JSON.parse(readFileSync(eventsFile(id), "utf8")) : []);
  return cache.get(id)!;
}

export function createThread(): Thread {
  const t: Thread = { id: crypto.randomUUID().slice(0, 8), title: "New conversation", created: new Date().toISOString() };
  threads.unshift(t);
  saveIndex();
  broadcast("threads", listThreads());
  return t;
}

export function deleteThread(id: string) {
  if (busyThread === id) proc?.kill();
  threads = threads.filter((t) => t.id !== id);
  cache.delete(id);
  rmSync(eventsFile(id), { force: true });
  saveIndex();
  broadcast("threads", listThreads());
}

export function stop() {
  proc?.kill();
}

export async function send(threadId: string, message: string) {
  const thread = threads.find((t) => t.id === threadId);
  const events = threadEvents(threadId);
  if (!thread || !events) throw new Error("No such thread");
  if (proc) throw new Error("Claude is still working on the last message");

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
  emit({ kind: "user", text: message, model, effort });

  // prompt goes in on stdin, so a message starting with "-" is never read as a flag
  const args = ["claude", "-p", "--output-format", "stream-json", "--verbose",
    "--include-partial-messages", "--model", model, "--effort", effort,
    "--permission-mode", "acceptEdits", "--allowedTools", ...ALLOWED];
  if (thread.sessionId) args.push("--resume", thread.sessionId);

  proc = Bun.spawn(args, { cwd: WORKSPACE, stdout: "pipe", stderr: "pipe", stdin: Buffer.from(message) });
  busyThread = threadId;
  broadcast("chat-busy", busyThread);
  let finished = false;
  try {
    let buf = "";
    for await (const chunk of proc.stdout as ReadableStream<Uint8Array>) {
      buf += new TextDecoder().decode(chunk);
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line);
        if (ev.session_id && ev.session_id !== thread.sessionId) {
          thread.sessionId = ev.session_id;
          saveIndex();
        }
        if (handle(ev, emit)) finished = true;
      }
    }
    const code = await proc.exited;
    if (!finished) {
      const err = (await new Response(proc.stderr as ReadableStream).text()).trim();
      emit({ kind: "done", error: err || (code === 143 || code === null ? "Stopped" : `claude exited with code ${code}`) });
    }
  } finally {
    flush();
    proc = null;
    busyThread = null;
    broadcast("chat-busy", null);
  }
}

// returns true on the final "result" event
function handle(ev: any, emit: (e: ChatEvent) => void): boolean {
  switch (ev.type) {
    case "stream_event": {
      const d = ev.event?.delta;
      if (ev.event?.type === "content_block_delta" && d?.type === "text_delta") emit({ kind: "text", text: d.text });
      return false;
    }
    case "assistant":
      for (const c of ev.message?.content ?? []) {
        if (c.type === "tool_use") emit({ kind: "tool", id: c.id, name: c.name, input: c.input });
      }
      return false;
    case "user":
      for (const c of ev.message?.content ?? []) {
        if (c.type !== "tool_result") continue;
        const out = typeof c.content === "string" ? c.content
          : (c.content ?? []).map((x: any) => x.text ?? "").join("\n");
        emit({ kind: "tool_result", id: c.tool_use_id, output: out, error: !!c.is_error });
      }
      return false;
    case "result":
      emit({ kind: "done", cost: ev.total_cost_usd, error: ev.is_error ? String(ev.result ?? "error") : undefined });
      return true;
  }
  return false;
}
