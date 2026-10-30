import { useEffect, useState } from "react";
import { ScrollText, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MorphingButton, type ButtonStatusState } from "@/components/ui/morphing-button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CodeBlock } from "@/components/ui/ai-response";
import { api, notify, useStudio } from "@/lib/api";

const since = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

// MT5's journal while live, refreshed every few seconds while open.
function JournalSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [log, setLog] = useState<string[] | null>(null);
  useEffect(() => {
    if (!open) return;
    const load = () => api.live().then((l) => setLog(l.log));
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [open]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[40rem]">
        <SheetHeader>
          <SheetTitle>MT5 journal</SheetTitle>
          <SheetDescription>Terminal and EA messages: login, the EA loading, orders and deals.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <CodeBlock language="log" filename="journal" code={log?.length ? log.join("\n") : "No journal lines yet."} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export function LiveBanner() {
  const live = useStudio((s) => s.live);
  const [status, setStatus] = useState<ButtonStatusState>("idle");
  const [journal, setJournal] = useState(false);
  if (!live) return null;

  const stop = async () => {
    setStatus("loading");
    try {
      await api.liveStop();
      notify({ tone: "info", title: "Live trading stopped", description: "MT5 is closed. Open positions, if any, are still open." });
    } catch (e) {
      notify({ tone: "error", title: "Couldn't stop", description: (e as Error).message });
    }
    setStatus("idle");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
      <Badge tone="success" dot pulse={live.running}>{live.running ? "LIVE" : "starting"}</Badge>
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-medium">{live.strategy} · {live.symbol} {live.period}</p>
        <p className="text-text-muted">account {live.login} ({live.server}) · since {since(live.started)}
          {live.inputs.InpLots && ` · ${live.inputs.InpLots} lots`}</p>
      </div>
      <button type="button" onClick={() => setJournal(true)}
        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus-ring">
        <ScrollText className="h-3.5 w-3.5" /> Journal
      </button>
      <MorphingButton variant="danger" status={status} onClick={stop} idleText="Stop" loadingText="Stopping…"
        idleIcon={<Square className="h-3.5 w-3.5" />} className="min-w-[96px]" />
      <JournalSheet open={journal} onOpenChange={setJournal} />
    </div>
  );
}
