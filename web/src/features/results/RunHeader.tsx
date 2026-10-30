import { useEffect, useState } from "react";
import { History, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MorphingButton, type ButtonStatusState } from "@/components/ui/morphing-button";
import { api, notify, useStudio } from "@/lib/api";
import type { RunMeta } from "@/lib/types";
import { runTime, shortDate } from "@/lib/format";

const MODELS: Record<string, string> = { "0": "every tick", "1": "1-min OHLC", "2": "open prices", "4": "real ticks" };

export function RunHeader({ meta, onHistory }: { meta: RunMeta; onHistory: () => void }) {
  const mt5 = useStudio((s) => s.mt5);
  const running = useStudio((s) => s.runs.some((r) => r.status === "running" && r.strategy === meta.strategy));
  const [status, setStatus] = useState<ButtonStatusState>("idle");
  const t = meta.tester;

  useEffect(() => { setStatus(running ? "loading" : "idle"); }, [running]);

  const rerun = async () => {
    setStatus("loading");
    try {
      await api.backtest(meta.strategy);
    } catch (e) {
      setStatus("error");
      notify({ tone: "warning", title: "Can't run the backtest", description: (e as Error).message });
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-semibold">{meta.strategy}</h2>
          <Badge tone={meta.status === "done" ? "success" : meta.status === "failed" ? "danger" : "warning"} dot pulse={meta.status === "running"}>
            {meta.status}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-text-muted">
          {t.Symbol} · {t.Period} · {shortDate(t.FromDate)} → {shortDate(t.ToDate)} · {MODELS[t.Model] ?? `model ${t.Model}`} · run {runTime(meta.id)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onHistory}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary focus-ring">
          <History className="h-3.5 w-3.5" /> Runs
        </button>
        <MorphingButton status={status} onClick={rerun} disabled={mt5 !== "ready" && !running}
          idleText="Re-run" loadingText="Backtesting…" successText="Done" errorText="Not started"
          idleIcon={<Play className="h-3.5 w-3.5" />} />
      </div>
    </div>
  );
}
