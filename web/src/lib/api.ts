// One SSE connection feeds a small external store; components read slices
// of it with useStudio(). Chat events also go to per-thread listeners.
import { useSyncExternalStore } from "react";
import type { ChatEvent, Mt5State, Run, RunMeta, Thread } from "./types";

export type RunSummary = RunMeta & { net?: string; pf?: string; trades?: string; win?: string; dd?: string };
export type Notice = { id: number; tone: "success" | "error" | "warning" | "info"; title: string; description?: string; runId?: string };

type State = {
  connected: boolean;
  threads: Thread[];
  busyThread: string | null;
  runs: RunSummary[];
  strategies: string[];
  mt5: Mt5State;
  notice: Notice | null;
};

let state: State = { connected: false, threads: [], busyThread: null, runs: [], strategies: [], mt5: "ready", notice: null };
const listeners = new Set<() => void>();
const chatListeners = new Set<(threadId: string, e: ChatEvent) => void>();
let noticeId = 0;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function notify(n: Omit<Notice, "id">) {
  set({ notice: { ...n, id: ++noticeId } });
}

export function useStudio<T>(pick: (s: State) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => pick(state));
}

export function onChat(fn: (threadId: string, e: ChatEvent) => void) {
  chatListeners.add(fn);
  return () => { chatListeners.delete(fn); };
}

export function connect() {
  const es = new EventSource("/api/events");
  const on = <T,>(type: string, fn: (d: T) => void) => es.addEventListener(type, (m) => fn(JSON.parse((m as MessageEvent).data)));
  es.onopen = () => set({ connected: true });
  es.onerror = () => set({ connected: false });
  on<Thread[]>("threads", (threads) => set({ threads }));
  on<string | null>("chat-busy", (busyThread) => set({ busyThread }));
  on<RunSummary[]>("runs", (runs) => {
    // a run that was running and now is not -> tell the user
    for (const r of runs) {
      const before = state.runs.find((x) => x.id === r.id);
      if (before?.status === "running" && r.status !== "running") {
        notify(r.status === "done"
          ? { tone: "success", title: `Backtest done · ${r.strategy}`, description: `Net ${r.net ?? "–"} · PF ${r.pf ?? "–"} · ${r.trades ?? 0} trades`, runId: r.id }
          : { tone: "error", title: `Backtest failed · ${r.strategy}`, description: r.error });
      }
    }
    set({ runs });
  });
  on<string[]>("strategies", (strategies) => set({ strategies }));
  on<Mt5State>("mt5", (mt5) => set({ mt5 }));
  on<{ threadId: string; event: ChatEvent }>("chat", ({ threadId, event }) => chatListeners.forEach((l) => l(threadId, event)));
  on<Omit<Notice, "id">>("notice", notify);
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? r.statusText);
  return body;
}

const post = (url: string, body?: unknown) =>
  call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

export const api = {
  run: (id: string) => call<Run>(`/api/runs/${encodeURIComponent(id)}`),
  runFiles: (id: string) => call<{ source: string; ini: string; log: string }>(`/api/runs/${encodeURIComponent(id)}/files`),
  thread: (id: string) => call<ChatEvent[]>(`/api/threads/${id}`),
  newThread: () => post("/api/threads") as Promise<Thread>,
  deleteThread: (id: string) => call(`/api/threads/${id}`, { method: "DELETE" }),
  send: (threadId: string, message: string) => post("/api/chat", { threadId, message }),
  stop: () => post("/api/chat/stop"),
  backtest: (strategy: string) => post(`/api/strategies/${strategy}/backtest`),
};
