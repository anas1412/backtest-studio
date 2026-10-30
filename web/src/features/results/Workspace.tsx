import { useEffect, useState } from "react";
import { CandlestickChart, Code2, FileText, ListOrdered } from "lucide-react";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton, SkeletonReveal } from "@/components/ui/skeleton";
import { api, useStudio } from "@/lib/api";
import type { Run, Trade } from "@/lib/types";
import { brokerTime } from "@/lib/format";
import { EmptyState } from "@/features/shell/EmptyState";
import { PriceChart, type Focus } from "./PriceChart";
import { EquityChart } from "./EquityChart";
import { StatsRow } from "./StatsRow";
import { TradesTable } from "./TradesTable";
import { CodeView, ReportView } from "./FilesView";
import { RunHeader } from "./RunHeader";
import { RunsSheet } from "./RunsSheet";

export function Workspace({ runId, onRunChange }: { runId: string | null; onRunChange: (id: string) => void }) {
  const runs = useStudio((s) => s.runs);
  const mt5 = useStudio((s) => s.mt5);
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("chart");
  const [focus, setFocus] = useState<Focus>(null);
  const [history, setHistory] = useState(false);
  const meta = runs.find((r) => r.id === runId);
  // runs are newest first, so the next finished one of this strategy is the previous run
  const prev = runs.slice(runs.findIndex((r) => r.id === runId) + 1)
    .find((r) => r.strategy === meta?.strategy && r.status === "done");

  useEffect(() => {
    if (!runId || meta?.status === "running") return;
    setLoading(true);
    api.run(runId).then(setRun).catch(() => setRun(null)).finally(() => setLoading(false));
  }, [runId, meta?.status]);

  const pick = (t: Trade) => {
    const a = brokerTime(t.entryTime), b = brokerTime(t.exitTime);
    const pad = Math.max(b - a, 3600) * 4;
    setTab("chart");
    setFocus({ from: a - pad, to: b + pad });
  };

  const banner = mt5 === "gui-open" && (
    <Alert tone="warning">
      <AlertTitle>MetaTrader 5 is open</AlertTitle>
      <AlertDescription>Close it to run backtests. The tester needs the same data folder and MT5 allows one terminal per folder.</AlertDescription>
    </Alert>
  );

  if (!runId || !meta) {
    return (
      <div className="flex h-full flex-col gap-4 p-5">
        {banner}
        <EmptyState title="No backtests yet" hint="Describe a strategy in the chat. Claude writes the EA, compiles it and runs it in your MT5 tester. Results land here." />
      </div>
    );
  }

  const shown = run?.meta.id === runId ? run : null;
  const tabs = [
    { id: "chart", label: "Chart", icon: <CandlestickChart className="h-3.5 w-3.5" /> },
    { id: "trades", label: "Trades", icon: <ListOrdered className="h-3.5 w-3.5" />, badge: shown?.trades.length },
    { id: "code", label: "Code", icon: <Code2 className="h-3.5 w-3.5" /> },
    { id: "report", label: "Report", icon: <FileText className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      {banner}
      <RunHeader meta={meta} onHistory={() => setHistory(true)} />
      <RunsSheet open={history} onOpenChange={setHistory} current={runId} onPick={onRunChange} />

      {meta.status === "failed" && (
        <Alert tone="danger">
          <AlertTitle>This run failed</AlertTitle>
          <AlertDescription>{meta.error}</AlertDescription>
        </Alert>
      )}

      {meta.status === "running" ? (
        <EmptyState busy title={`Backtesting ${meta.strategy}…`} hint="MT5's tester is running in the background. The results open here when it finishes." />
      ) : (
        <SkeletonReveal loading={loading && !shown} skeleton={<Skeleton className="h-[480px] w-full rounded-2xl" />}>
          {shown && (
            <div className="flex flex-col gap-4">
              <StatsRow summary={shown.summary} trades={shown.trades} prev={prev} />
              <AnimatedTabs tabs={tabs} activeTab={tab} onChange={setTab} renderContent={false} variant="pill" />
              {/* the trades table brings its own frame */}
              <section className={tab === "trades" ? "" : "rounded-2xl border border-border bg-surface p-4"}>
                {tab === "chart" && (
                  <div className="flex flex-col gap-4">
                    <div className="h-[52vh] min-h-[320px]">
                      {shown.bars.length
                        ? <PriceChart bars={shown.bars} deals={shown.deals} focus={focus} />
                        : <EmptyState title="No price data for this run" hint="The bar export did not produce a file. The stats and trades are still valid." />}
                    </div>
                    <EquityChart deals={shown.deals} />
                  </div>
                )}
                {tab === "trades" && <TradesTable trades={shown.trades} onPick={pick} />}
                {tab === "code" && <CodeView runId={runId} strategy={meta.strategy} />}
                {tab === "report" && <ReportView runId={runId} summary={shown.summary} />}
              </section>
            </div>
          )}
        </SkeletonReveal>
      )}
    </div>
  );
}
