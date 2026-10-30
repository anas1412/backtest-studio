import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { VelocityToast } from "@/components/ui/velocity-toast";
import { Sheet, SheetBody, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useStudio } from "@/lib/api";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { Workspace } from "@/features/results/Workspace";
import { NewStrategySheet } from "@/features/shell/NewStrategySheet";
import { useLocalNumber, useMediaQuery } from "@/hooks/use-layout";

export default function App() {
  const runs = useStudio((s) => s.runs);
  const strategies = useStudio((s) => s.strategies);
  const loaded = useStudio((s) => s.loaded);
  const threads = useStudio((s) => s.threads);
  const notice = useStudio((s) => s.notice);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [split, setSplit] = useLocalNumber("studio.split", 30);
  const wide = useMediaQuery("(min-width: 900px)");
  const dragging = useRef(false);
  const seenRunning = useRef(new Set<string>());
  const knownStrategies = useRef<Set<string> | null>(null);

  // picking a strategy shows its latest run, if it has one
  const chooseStrategy = (name: string) => {
    setStrategy(name);
    setRunId(runs.find((r) => r.strategy === name)?.id ?? null);
  };
  const openRun = (id: string) => {
    const r = runs.find((x) => x.id === id);
    if (r) setStrategy(r.strategy);
    setRunId(id);
  };

  // default: the strategy of the newest run, else the first strategy
  useEffect(() => {
    if (!loaded || (strategy && strategies.includes(strategy))) return;
    const name = runs.find((r) => strategies.includes(r.strategy))?.strategy ?? strategies[0] ?? null;
    if (name) chooseStrategy(name); else setStrategy(null);
  }, [loaded, strategies]); // eslint-disable-line react-hooks/exhaustive-deps

  // follow Claude: a strategy that appears after load opens itself
  useEffect(() => {
    if (!loaded) return;
    if (knownStrategies.current) {
      const fresh = strategies.find((s) => !knownStrategies.current!.has(s));
      if (fresh) chooseStrategy(fresh);
    }
    knownStrategies.current = new Set(strategies);
  }, [loaded, strategies]); // eslint-disable-line react-hooks/exhaustive-deps

  // jump to a backtest once, when it starts; the user can still look elsewhere
  useEffect(() => {
    for (const r of runs) {
      if (r.status === "running" && !seenRunning.current.has(r.id)) {
        seenRunning.current.add(r.id);
        setStrategy(r.strategy);
        setRunId(r.id);
      }
    }
  }, [runs]);

  useEffect(() => {
    if (!threadId && threads.length) setThreadId(threads[0].id);
  }, [threads, threadId]);

  // a finished run opens itself and shows a toast
  useEffect(() => {
    if (!notice) return;
    if (notice.runId) openRun(notice.runId);
    setToastOpen(true);
  }, [notice]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragging.current) setSplit(Math.min(50, Math.max(22, (e.clientX / window.innerWidth) * 100)));
    };
    const up = () => { dragging.current = false; document.body.style.userSelect = ""; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [setSplit]);

  const chat = <ChatPanel threadId={threadId} onThread={setThreadId} runId={runId} onOpenRun={(id) => { openRun(id); setChatOpen(false); }} />;
  const workspace = <Workspace strategy={strategy} runId={runId} onStrategy={chooseStrategy} onRunChange={openRun} onNewStrategy={() => setNewOpen(true)} />;

  return (
    <div className="flex h-dvh flex-col bg-background text-text-primary">
      <NewStrategySheet open={newOpen} onOpenChange={setNewOpen} onSent={(id) => { setThreadId(id); setChatOpen(true); }} />
      {wide ? (
        <div className="flex min-h-0 flex-1">
          <aside className="min-w-0 border-r border-border" style={{ width: `${split}%` }}>{chat}</aside>
          <div role="separator" aria-orientation="vertical" aria-label="Resize panels"
            onPointerDown={() => { dragging.current = true; document.body.style.userSelect = "none"; }}
            onDoubleClick={() => setSplit(30)}
            className="-mx-1 w-2 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-border" />
          <main className="min-w-0 flex-1">
            {workspace}
          </main>
        </div>
      ) : (
        <main className="min-h-0 flex-1">
          {workspace}
          <button type="button" onClick={() => setChatOpen(true)}
            className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-text-primary px-4 py-2.5 text-sm font-medium text-background shadow-elevated focus-ring">
            <MessageSquare className="h-4 w-4" /> Chat
          </button>
          <Sheet open={chatOpen} onOpenChange={setChatOpen}>
            <SheetContent side="bottom" className="h-[85dvh] max-w-none">
              <SheetTitle className="sr-only">Chat</SheetTitle>
              <SheetBody className="h-full p-0">{chat}</SheetBody>
            </SheetContent>
          </Sheet>
        </main>
      )}

      {notice && (
        <VelocityToast key={notice.id} open={toastOpen} onDismiss={() => setToastOpen(false)}
          title={notice.title} description={notice.description} position="bottom-right" duration={6000}
          variant={notice.tone === "error" ? "error" : notice.tone} />
      )}
    </div>
  );
}
