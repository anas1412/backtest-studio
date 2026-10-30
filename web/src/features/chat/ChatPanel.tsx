import { useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, Square } from "lucide-react";
import { Chat, ChatComposer, ChatHeader, ChatMessage, ChatSidebar, useChat, type ChatConversationThread } from "@/components/ui/chat";
import { AIResponse, AIResponseContent } from "@/components/ui/ai-response";
import { AIAgentActivity, AgentActivityTimeline } from "@/components/ui/ai-agent-activity";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThinkingOrb } from "@/components/ui/thinking-orb";
import { api, notify, onChat, useStudio } from "@/lib/api";
import type { ChatEvent, Thread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildTranscript } from "./transcript";
import { RunCard } from "./RunCard";
import { ModelPicker, MODEL_LABELS } from "./ModelPicker";
import { ChatSkeleton } from "@/features/shell/Skeletons";

function group(t: Thread): string {
  const days = Math.floor((Date.now() - new Date(t.created).getTime()) / 86_400_000);
  return days < 1 ? "Today" : days < 2 ? "Yesterday" : "Previous";
}

// Lives inside <Chat> so it can drive the thread drawer through its context.
function ThreadsToggle() {
  const { isSidebarOpen, setIsSidebarOpen } = useChat();
  return (
    <button type="button" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Conversations"
      className="ml-3 rounded-lg border border-border p-1.5 text-text-muted transition-colors hover:text-text-primary focus-ring">
      <PanelLeft className="h-4 w-4" />
    </button>
  );
}

function ThreadsDrawer() {
  const { isSidebarOpen } = useChat();
  // the stock sidebar is static on desktop; here it overlays the narrow panel
  return (
    <ChatSidebar overlay className={cn(
      "absolute md:absolute bg-surface dark:bg-surface shadow-elevated",
      isSidebarOpen ? "md:translate-x-0" : "md:-translate-x-full shadow-none",
    )} />
  );
}

export function ChatPanel({ threadId, onThread, runId, onOpenRun }: {
  threadId: string | null; onThread: (id: string) => void; runId: string | null; onOpenRun: (id: string) => void;
}) {
  const threads = useStudio((s) => s.threads);
  const busyThread = useStudio((s) => s.busyThread);
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const loaded = useStudio((s) => s.loaded);
  const bottom = useRef<HTMLDivElement>(null);
  const live = busyThread === threadId && threadId !== null;

  useEffect(() => {
    setEvents([]);
    if (!threadId) return;
    setLoadingThread(true);
    api.thread(threadId).then(setEvents).catch(() => setEvents([])).finally(() => setLoadingThread(false));
  }, [threadId]);

  useEffect(() => onChat((id, e) => { if (id === threadId) setEvents((prev) => [...prev, e]); }), [threadId]);

  const items = useMemo(() => buildTranscript(events, live), [events, live]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [items.length, events.length]);

  const send = async (text: string) => {
    try {
      let id = threadId;
      if (!id) {
        id = (await api.newThread()).id;
        onThread(id);
      }
      await api.send(id, text);
    } catch (e) {
      notify({ tone: "error", title: "Message not sent", description: (e as Error).message });
    }
  };

  const chatThreads: ChatConversationThread[] = threads.map((t) => ({ id: t.id, title: t.title, timestamp: t.created, group: group(t) }));
  const lastAssistant = items.findLastIndex((i) => i.kind === "assistant");
  // Claude is working but nothing is streaming or running: show it thinking
  const last = items[items.length - 1];
  const thinking = live && last && last.kind !== "assistant"
    && !(last.kind === "tools" && last.steps.some((s) => s.status === "running"));

  return (
    <Chat
      messages={[]}
      onSendMessage={send}
      isGenerating={busyThread !== null}
      threads={chatThreads}
      activeThreadId={threadId ?? undefined}
      onSelectThread={onThread}
      onNewChat={async () => onThread((await api.newThread()).id)}
      className="relative h-full rounded-none border-0 sm:h-full"
    >
      <ThreadsDrawer />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-border">
          <ThreadsToggle />
          <ChatHeader className="flex-1 border-0" title={threads.find((t) => t.id === threadId)?.title ?? "New conversation"}
            subtitle="Writes, compiles and backtests MQL5" />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {(!loaded || loadingThread) && <ChatSkeleton />}
          {loaded && !loadingThread && items.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <ThinkingOrb size={64} state="breathing" />
              <h3 className="mt-4 text-sm font-semibold">What should we test?</h3>
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-text-muted">
                Describe entries, exits, risk, symbol and dates. Claude writes the EA, compiles it and runs your MT5 tester.
              </p>
            </div>
          )}
          {items.map((it, idx) => {
            switch (it.kind) {
              case "user":
                return (
                  <ChatMessage key={it.key} message={{
                    id: it.key, role: "user", content: it.text,
                    // which model answered this message
                    timestamp: it.model ? `${MODEL_LABELS[it.model] ?? it.model} · ${it.effort} effort` : "default model",
                  }} />
                );
              case "assistant":
                return (
                  <AIResponse key={it.key} content={it.text.trim()}
                    status={live && idx === lastAssistant ? "streaming" : "complete"} className="p-4 sm:p-4">
                    <AIResponseContent />
                  </AIResponse>
                );
              case "tools":
                return (
                  <AIAgentActivity key={it.key} activities={it.steps} isRunning={live} className="rounded-xl">
                    <AgentActivityTimeline className="px-3 py-3 sm:px-4 sm:py-3" />
                  </AIAgentActivity>
                );
              case "run":
                return <RunCard key={it.key} runId={it.runId} active={it.runId === runId} onOpen={onOpenRun} />;
              case "error":
                return (
                  <Alert key={it.key} tone={it.text === "Stopped" ? "neutral" : "danger"}>
                    <AlertDescription className="mt-0">{it.text}</AlertDescription>
                  </Alert>
                );
            }
          })}
          {thinking && (
            <AIResponse status="generating" className="p-4 sm:p-4">
              <AIResponseContent />
            </AIResponse>
          )}
          <div ref={bottom} />
        </div>

        {busyThread && (
          <div className="flex items-center gap-2.5 border-t border-border px-4 py-2 text-xs text-text-secondary">
            <ThinkingOrb size={22} state="working" />
            <span className="flex-1">{busyThread === threadId ? "Claude is working…" : "Claude is busy in another conversation"}</span>
            <button type="button" onClick={() => api.stop()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-medium transition-colors hover:border-border-hover hover:text-text-primary focus-ring">
              <Square className="h-3 w-3" /> Stop
            </button>
          </div>
        )}
        <ChatComposer allowAttachments={false} placeholder="Describe a strategy or ask for a change…" toolbar={<ModelPicker />} />
      </div>
    </Chat>
  );
}
