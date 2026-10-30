import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useStudio } from "@/lib/api";
import { num, runTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RunsSheet({ open, onOpenChange, current, onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; current: string | null; onPick: (id: string) => void;
}) {
  const runs = useStudio((s) => s.runs);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Runs</SheetTitle>
          <SheetDescription>Every backtest, newest first.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-1.5">
          {runs.map((r) => {
            const net = num(r.net);
            return (
              <button key={r.id} type="button" onClick={() => { onPick(r.id); onOpenChange(false); }}
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-left transition-colors focus-ring",
                  r.id === current ? "border-border-hover bg-surface-hover" : "border-border hover:bg-surface-hover",
                )}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{r.strategy}</span>
                  {r.status === "done"
                    ? <span className={cn("text-sm font-semibold tabular-nums", net >= 0 ? "text-emerald-500" : "text-rose-500")}>{r.net}</span>
                    : <Badge tone={r.status === "failed" ? "danger" : "warning"} dot pulse={r.status === "running"}>{r.status}</Badge>}
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-text-muted">
                  <span>{r.tester.Symbol} · {r.tester.Period} · {runTime(r.id)}</span>
                  {r.status === "done" && <span>PF {r.pf} · {r.trades} trades</span>}
                </div>
              </button>
            );
          })}
          {!runs.length && <p className="text-sm text-text-muted">No runs yet.</p>}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
