import { useEffect, useMemo, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { SpringSelect } from "@/components/ui/spring-select";
import { DateRangeField } from "@/features/shell/DateRangeField";
import type { DateRange } from "@/components/ui/calendar";
import { Input } from "@/components/ui/form";
import { MorphingButton, type ButtonStatusState } from "@/components/ui/morphing-button";
import { api, notify, useStudio } from "@/lib/api";
import type { Settings, SymbolList } from "@/lib/types";
import { TICK_MODELS, TIMEFRAMES, dateToIni, iniToDate } from "@/lib/mt5";
import { SettingsSkeleton } from "@/features/shell/Skeletons";
import { cn } from "@/lib/utils";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-[11px] font-medium text-text-muted">{label}</p>
      {children}
    </div>
  );
}

// Edits the strategy's tester.ini [Tester] keys and runs it. Values load from
// the file each time a run of this strategy finishes, since Claude may edit it.
export function SettingsBar({ strategy, reloadKey }: { strategy: string; reloadKey: string }) {
  const mt5 = useStudio((s) => s.mt5);
  const running = useStudio((s) => s.runs.some((r) => r.status === "running" && r.strategy === strategy));
  const hasRuns = useStudio((s) => s.runs.some((r) => r.strategy === strategy));
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [symbols, setSymbols] = useState<SymbolList | null>(null);
  const [status, setStatus] = useState<ButtonStatusState>("idle");
  // the picker reports the first click as a half range; hold it here until
  // the second click completes it, or the old dates would snap back
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  useEffect(() => {
    if (draft) setRange({ from: iniToDate(draft.FromDate), to: iniToDate(draft.ToDate) });
  }, [draft?.FromDate, draft?.ToDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.settings(strategy).then((s) => { setSaved(s); setDraft(s); }).catch(() => setDraft(null));
  }, [strategy, reloadKey]);
  useEffect(() => { api.symbols().then(setSymbols); }, [reloadKey]);
  useEffect(() => setStatus(running ? "loading" : "idle"), [running]);

  const options = useMemo(() => (symbols?.symbols ?? []).map((s) => ({
    value: s.name,
    label: s.name,
    description: [
      s.description,
      s.history ? `history ${s.history[0]}–${s.history[1]}` : "no history yet (MT5 downloads it on first test)",
      s.spread !== null ? `spread ${s.spread} pts` : "",
    ].filter(Boolean).join(" · "),
    keywords: [s.description, s.path],
  })), [symbols]);

  if (!draft) return <SettingsSkeleton />;
  const sym = symbols?.symbols.find((s) => s.name === draft.Symbol);
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const run = async () => {
    setStatus("loading");
    try {
      await api.backtest(strategy, draft);
      setSaved(draft);
    } catch (e) {
      setStatus("error");
      notify({ tone: "warning", title: "Can't run the backtest", description: (e as Error).message });
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Symbol" className="w-56">
          <div className="flex items-center gap-1.5">
            <Combobox className="min-w-0 flex-1" options={options} value={draft.Symbol}
              onValueChange={(v) => v && set({ Symbol: v })} searchPlaceholder="Search 160+ symbols…" aria-label="Symbol" />
            <button type="button" title="Read symbols and spreads from MT5 (MT5 must be closed)" aria-label="Refresh symbols from MT5"
              disabled={mt5 !== "ready"} onClick={() => api.refreshSymbols().catch((e) => notify({ tone: "warning", title: "Can't refresh", description: e.message }))}
              className="rounded-lg border border-border p-2 text-text-muted transition-colors hover:text-text-primary disabled:opacity-40 focus-ring">
              <RefreshCw className={cn("h-3.5 w-3.5", mt5 === "symbols" && "animate-spin")} />
            </button>
          </div>
        </Field>
        <Field label="Timeframe" className="w-28">
          <SpringSelect options={TIMEFRAMES.map((t) => ({ value: t, label: t }))} value={draft.Period} onChange={(v) => set({ Period: v })} />
        </Field>
        <Field label="Tick model" className="w-44">
          <SpringSelect options={TICK_MODELS} value={draft.Model} onChange={(v) => set({ Model: v })} />
        </Field>
        <Field label="Dates" className="w-[26rem]">
          <DateRangeField value={range} historyStart={sym?.history?.[0]}
            onChange={(r) => {
              setRange(r);
              if (r.from && r.to) set({ FromDate: dateToIni(r.from), ToDate: dateToIni(r.to) });
            }} />
        </Field>
        <Field label={`Deposit (${draft.Currency || "USD"})`} className="w-28">
          <Input inputMode="numeric" value={draft.Deposit} onChange={(e) => set({ Deposit: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <div className="ml-auto flex flex-col items-end gap-1">
          {dirty && <span className="text-[11px] text-amber-500">changed, not run yet</span>}
          <MorphingButton status={status} onClick={run} disabled={mt5 !== "ready" && !running}
            idleText={!hasRuns ? "Run backtest" : dirty ? "Run with these" : "Run again"} loadingText="Backtesting…" successText="Done" errorText="Not started"
            idleIcon={<Play className="h-3.5 w-3.5" />} />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-text-muted">
        {sym?.spread != null ? `Live spread ${sym.spread} pts. ` : ""}
        The tester uses the broker's recorded historical spread{draft.Model === "4" ? " tick by tick" : " per bar"}; it can't be overridden in tester.ini.
        {symbols?.refreshed ? "" : " Symbol list not read from MT5 yet: press ↻ (MT5 must be closed)."}
      </p>
    </div>
  );
}
