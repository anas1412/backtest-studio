import { useEffect, useState } from "react";
import { Stepper } from "@/components/ui/stepper";
import { Loader } from "@/components/ui/loader";
import type { RunMeta } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { TICK_MODELS } from "@/lib/mt5";

const STEPS = [
  { title: "Compile", description: "MetaEditor" },
  { title: "Test", description: "MT5 Strategy Tester" },
  { title: "Report", description: "Reading results" },
  { title: "Chart data", description: "Exporting bars" },
];
const STAGE_INDEX = { tester: 1, report: 2, bars: 3 } as const;

function useElapsed(since: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Shown in place of the results while MT5 works; stages come from meta.json.
export function BacktestProgress({ meta }: { meta: RunMeta }) {
  const elapsed = useElapsed(meta.started);
  const t = meta.tester;
  const model = TICK_MODELS.find((m) => m.value === t.Model);
  const current = STAGE_INDEX[meta.stage ?? "tester"];

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Loader variant="rings" size={36} label="Backtest running" />
          <div>
            <h3 className="text-sm font-semibold">Backtesting {meta.strategy}</h3>
            <p className="mt-0.5 text-xs text-text-muted">
              {t.Symbol} · {t.Period} · {shortDate(t.FromDate)} → {shortDate(t.ToDate)} · {model?.label ?? `model ${t.Model}`}
            </p>
          </div>
        </div>
        <span className="font-mono text-sm tabular-nums text-text-secondary" aria-label="Elapsed time">{elapsed}</span>
      </div>
      <Stepper className="mt-8" steps={STEPS} current={current} />
      <p className="mt-6 text-[11px] text-text-muted">
        {t.Model === "4"
          ? "Real-tick runs replay every recorded tick, so long date ranges can take several minutes."
          : "MT5 runs in the background; results open here when it finishes."}
      </p>
    </div>
  );
}
