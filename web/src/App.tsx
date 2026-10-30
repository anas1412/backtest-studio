import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { VelocityToast } from "@/components/ui/velocity-toast";
import { Sheet, SheetBody, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useStudio } from "@/lib/api";
import { TopBar } from "@/features/shell/TopBar";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { Workspace } from "@/features/results/Workspace";
import { useLocalNumber, useMediaQuery } from "@/hooks/use-layout";

export default function App() {
  const runs = useStudio((s) => s.runs);
  const threads = useStudio((s) => s.threads);
  const notice = useStudio((s) => s.notice);
  const [runId, setRunId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [split, setSplit] = useLocalNumber("studio.split", 30);
  const wide = useMediaQuery("(min-width: 900px)");
  const dragging = useRef(false);
  const seenRunning = useRef(new Set<string>());

  // defaults: newest finished run, newest conversation
  useEffect(() => {
    if (!runId && runs.length) setRunId((runs.find((r) => r.status !== "running") ?? runs[0]).id);
    // jump to a backtest once, when it starts; the user can still look elsewhere
    for (const r of runs) {
      if (r.status === "running" && !seenRunning.current.has(r.id)) {
        seenRunning.current.add(r.id);
        setRunId(r.id);
      }
    }
  }, [runs, runId]);
  useEffect(() => {
    if (!threadId && threads.length) setThreadId(threads[0].id);
  }, [threads, threadId]);

  // a finished run opens itself and shows a toast
  useEffect(() => {
    if (!notice) return;
    if (notice.runId) setRunId(notice.runId);
    setToastOpen(true);
  }, [notice]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragging.current) setSplit(Math.min(50, Math.max(22, (e.clientX / window.innerWidth) * 100)));
    };
    const up = () => { dragging.current = false; document.body.style.userSelect = ""; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [setSplit]);

  const chat = <ChatPanel threadId={threadId} onThread={setThreadId} runId={runId} onOpenRun={(id) => { setRunId(id); setChatOpen(false); }} />;

  return (
    <div className="flex h-dvh flex-col bg-background text-text-primary">
      <TopBar runId={runId} onRunChange={setRunId} />
      {wide ? (
        <div className="flex min-h-0 flex-1">
          <aside className="min-w-0 border-r border-border" style={{ width: `${split}%` }}>{chat}</aside>
          <div role="separator" aria-orientation="vertical" aria-label="Resize panels"
            onPointerDown={() => { dragging.current = true; document.body.style.userSelect = "none"; }}
            onDoubleClick={() => setSplit(30)}
            className="-mx-1 w-2 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-border" />
          <main className="min-w-0 flex-1">
            <Workspace runId={runId} onRunChange={setRunId} />
          </main>
        </div>
      ) : (
        <main className="min-h-0 flex-1">
          <Workspace runId={runId} onRunChange={setRunId} />
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
