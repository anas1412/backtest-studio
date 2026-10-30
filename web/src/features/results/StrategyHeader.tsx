import { History, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { useStudio } from "@/lib/api";
import type { RunMeta } from "@/lib/types";
import { runTime, shortDate } from "@/lib/format";
import { TICK_MODELS } from "@/lib/mt5";


// Top of the results panel: which strategy (switchable), which run of it,
// and the controls that used to live in a separate top bar.
export function StrategyHeader({ strategy, meta, avgSpread, onStrategy, onNewStrategy, onHistory }: {
  strategy: string | null; meta?: RunMeta; avgSpread: number | null;
  onStrategy: (name: string) => void; onNewStrategy: () => void; onHistory: () => void;
}) {
  const strategies = useStudio((s) => s.strategies);
  const runs = useStudio((s) => s.runs);
  const count = runs.filter((r) => r.strategy === strategy).length;
  const t = meta?.tester;
  const model = t && (TICK_MODELS.find((x) => x.value === t.Model)?.label ?? `model ${t.Model}`);

  const options = strategies.map((name) => {
    const last = runs.find((r) => r.strategy === name);
    return {
      value: name,
      label: name,
      description: !last ? "not run yet"
        : last.status === "done" ? `${last.tester.Symbol} ${last.tester.Period} · last run ${runTime(last.id)} · net ${last.net}`
        : `last run ${last.status}`,
    };
  });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {strategies.length > 0 && (
          <Combobox className="w-64" aria-label="Strategy" value={strategy} onValueChange={(v) => v && onStrategy(v)}
            placeholder="Pick a strategy…" searchPlaceholder={`Search ${strategies.length} strategies…`} options={options} />
        )}
        {strategy && (meta
          ? <Badge tone={meta.status === "done" ? "success" : meta.status === "failed" ? "danger" : "warning"} dot pulse={meta.status === "running"}>{meta.status}</Badge>
          : <Badge>not run yet</Badge>)}

        <div className="ml-auto flex items-center gap-2">
          {count > 0 && (
            <button type="button" onClick={onHistory}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary focus-ring">
              <History className="h-3.5 w-3.5" /> {count} {count === 1 ? "run" : "runs"}
            </button>
          )}
          <button type="button" onClick={onNewStrategy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-text-primary px-3 text-xs font-medium text-background shadow-xs transition-opacity hover:opacity-90 focus-ring">
            <Plus className="h-3.5 w-3.5" /> New strategy
          </button>
        </div>
      </div>
      {strategy && (
        <p className="text-xs text-text-muted">
          {t
            ? <>Showing run {runTime(meta!.id)}: {t.Symbol} · {t.Period} · {shortDate(t.FromDate)} → {shortDate(t.ToDate)} · {model}{avgSpread !== null && ` · avg spread ${avgSpread} pts`}</>
            : "No backtests of this strategy yet"}
        </p>
      )}
    </div>
  );
}
