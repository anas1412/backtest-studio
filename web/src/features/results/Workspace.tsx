import { useEffect, useState } from "react";
import { CandlestickChart, Code2, FileText, ListOrdered } from "lucide-react";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SkeletonReveal } from "@/components/ui/skeleton";
import { api, useStudio } from "@/lib/api";
import type { Run, Trade } from "@/lib/types";
import { brokerTime } from "@/lib/format";
import { EmptyState } from "@/features/shell/EmptyState";
import { PriceChart, type Focus } from "./PriceChart";
import { EquityChart } from "./EquityChart";
import { StatsRow } from "./StatsRow";
import { TradesTable } from "./TradesTable";
import { CodeView, ReportView } from "./FilesView";
import { StrategyHeader } from "./StrategyHeader";
import { RunsSheet } from "./RunsSheet";
import { SettingsBar } from "./SettingsBar";
import { BacktestProgress } from "./BacktestProgress";
import { RunSkeleton, WorkspaceSkeleton } from "@/features/shell/Skeletons";

// Everything for one strategy: its test settings, then the selected run of it.
export function Workspace({ strategy, runId, onStrategy, onRunChange, onNewStrategy }: {
  strategy: string | null; runId: string | null; onStrategy: (name: string) => void;
  onRunChange: (id: string) => void; onNewStrategy: () => void;
}) {
  const runs = useStudio((s) => s.runs);
  const loaded = useStudio((s) => s.loaded);
  const mt5 = useStudio((s) => s.mt5);
  const version = useStudio((s) => s.strategiesVersion);
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("chart");
  const [focus, setFocus] = useState<Focus>(null);
  const [history, setHistory] = useState(false);
  const meta = runs.find((r) => r.id === runId && r.strategy === strategy);
  // runs are newest first, so the next finished one of this strategy is the previous run
  const prev = runs.slice(runs.findIndex((r) => r.id === runId) + 1)
    .find((r) => r.strategy === strategy && r.status === "done");

  useEffect(() => {
    if (!meta || meta.status === "running") return;
    setLoading(true);
    api.run(meta.id).then(setRun).catch(() => setRun(null)).finally(() => setLoading(false));
  }, [meta?.id, meta?.status]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!loaded) return <WorkspaceSkeleton />;

  if (!strategy) {
    return (
      <div className="flex h-full flex-col gap-4 p-5">
        <StrategyHeader strategy={null} avgSpread={null} onStrategy={onStrategy} onNewStrategy={onNewStrategy} onHistory={() => {}} />
        {banner}
        <EmptyState title="No strategies yet"
          hint="Press New strategy, or describe one in the chat. Claude writes the EA, compiles it, and it appears here."
          action={{ label: "New strategy", onClick: onNewStrategy }} />
      </div>
    );
  }

  const shown = meta && run?.meta.id === meta.id ? run : null;
  const tabs = [
    { id: "chart", label: "Chart", icon: <CandlestickChart className="h-3.5 w-3.5" /> },
    { id: "trades", label: "Trades", icon: <ListOrdered className="h-3.5 w-3.5" />, badge: shown?.trades.length },
    { id: "code", label: "Code", icon: <Code2 className="h-3.5 w-3.5" /> },
    { id: "report", label: "Report", icon: <FileText className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <StrategyHeader strategy={strategy} meta={meta} avgSpread={shown?.avgSpread ?? null}
        onStrategy={onStrategy} onNewStrategy={onNewStrategy} onHistory={() => setHistory(true)} />
      {banner}
      <SettingsBar strategy={strategy}
        reloadKey={`${version}-${runs.filter((r) => r.strategy === strategy && r.status !== "running").length}`} />
      <RunsSheet strategy={strategy} open={history} onOpenChange={setHistory} current={runId} onPick={onRunChange} />

      {!meta ? (
        <>
          <EmptyState title="Not backtested yet"
            hint="Check the symbol, timeframe and dates above, then press Run. To change the logic, ask Claude in the chat." />
          <section className="rounded-2xl border border-border bg-surface p-4">
            <CodeView runId={null} strategy={strategy} />
          </section>
        </>
      ) : meta.status === "running" ? (
        <BacktestProgress meta={meta} />
      ) : (
        <>
          {meta.status === "failed" && (
            <Alert tone="danger">
              <AlertTitle>This run failed</AlertTitle>
              <AlertDescription>{meta.error}</AlertDescription>
            </Alert>
          )}
          <SkeletonReveal loading={loading && !shown} skeleton={<RunSkeleton />}>
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
                  {tab === "code" && <CodeView runId={meta.id} strategy={strategy} />}
                  {tab === "report" && <ReportView runId={meta.id} summary={shown.summary} />}
                </section>
              </div>
            )}
          </SkeletonReveal>
        </>
      )}
    </div>
  );
}
