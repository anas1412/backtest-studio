import { ArrowUpRight } from "lucide-react";
import { useStudio } from "@/lib/api";
import { num, runTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// Compact result in the chat after a backtest; opens the run on the right.
export function RunCard({ runId, active, onOpen }: { runId: string; active: boolean; onOpen: (id: string) => void }) {
  const run = useStudio((s) => s.runs.find((r) => r.id === runId));
  if (!run) return null;
  const net = num(run.net);
  return (
    <button type="button" onClick={() => onOpen(runId)}
      className={cn(
        "group ml-9 flex w-[calc(100%-2.25rem)] items-center gap-3 rounded-xl border bg-surface px-3.5 py-2.5 text-left transition-colors focus-ring",
        active ? "border-border-hover" : "border-border hover:border-border-hover",
      )}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{run.strategy}</p>
        <p className="text-[11px] text-text-muted">{run.tester.Symbol} {run.tester.Period} · {runTime(run.id)}</p>
      </div>
      {run.status === "done" ? (
        <div className="text-right">
          <p className={cn("text-sm font-semibold tabular-nums", net >= 0 ? "text-emerald-500" : "text-rose-500")}>{run.net}</p>
          <p className="text-[11px] text-text-muted">PF {run.pf} · {run.trades} trades</p>
        </div>
      ) : (
        <p className="text-xs text-text-muted">{run.status}</p>
      )}
      <ArrowUpRight className="h-3.5 w-3.5 text-text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </button>
  );
}
