import { useEffect, useMemo, useState } from "react";
import { Play, Radio, RefreshCw } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { SpringSelect } from "@/components/ui/spring-select";
import { DateRangeField } from "@/features/shell/DateRangeField";
import type { DateRange } from "@/components/ui/calendar";
import { Input } from "@/components/ui/form";
import { MorphingButton, type ButtonStatusState } from "@/components/ui/morphing-button";
import { api, notify, useStudio } from "@/lib/api";
import type { Settings, StrategyInput, SymbolList } from "@/lib/types";
import { TICK_MODELS, TIMEFRAMES, dateToIni, iniToDate } from "@/lib/mt5";
import { SettingsSkeleton } from "@/features/shell/Skeletons";
import { cn } from "@/lib/utils";
import { GoLiveSheet } from "./GoLiveSheet";
import { InputsPanel } from "./InputsPanel";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1 truncate text-[11px] font-medium text-text-muted">{label}</p>
      {children}
    </div>
  );
}

// Test settings (tester.ini [Tester]) and the strategy's own inputs
// ([TesterInputs]): one place to edit, then run a backtest or go live with
// exactly these values. Reloads when Claude edits the strategy or a run ends.
export function SettingsBar({ strategy, reloadKey }: { strategy: string; reloadKey: string }) {
  const mt5 = useStudio((s) => s.mt5);
  const running = useStudio((s) => s.runs.some((r) => r.status === "running" && r.strategy === strategy));
  const hasRuns = useStudio((s) => s.runs.some((r) => r.strategy === strategy));
  const [saved, setSaved] = useState<{ settings: Settings; inputs: Record<string, string> } | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [inputs, setInputs] = useState<StrategyInput[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [symbols, setSymbols] = useState<SymbolList | null>(null);
  const [status, setStatus] = useState<ButtonStatusState>("idle");
  const [liveOpen, setLiveOpen] = useState(false);
  // the picker reports the first click as a half range; hold it here until
  // the second click completes it, or the old dates would snap back
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  useEffect(() => {
    if (draft) setRange({ from: iniToDate(draft.FromDate), to: iniToDate(draft.ToDate) });
  }, [draft?.FromDate, draft?.ToDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([api.settings(strategy), api.inputs(strategy)]).then(([s, inp]) => {
      const v = Object.fromEntries(inp.map((i) => [i.name, i.value]));
      setSaved({ settings: s, inputs: v });
      setDraft(s);
      setInputs(inp);
      setValues(v);
    }).catch(() => setDraft(null));
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

  if (!draft || !saved) return <SettingsSkeleton />;
  const sym = symbols?.symbols.find((s) => s.name === draft.Symbol);
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.settings) || JSON.stringify(values) !== JSON.stringify(saved.inputs);

  const run = async () => {
    setStatus("loading");
    try {
      await api.backtest(strategy, draft, values);
      setSaved({ settings: draft, inputs: values });
    } catch (e) {
      setStatus("error");
      notify({ tone: "warning", title: "Can't run the backtest", description: (e as Error).message });
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-end gap-3 p-3">
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
      </div>

      {inputs.length > 0 && (
        <div className="border-t border-border">
          <InputsPanel inputs={inputs} values={values} onChange={setValues} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border p-3">
        <p className="min-w-0 flex-1 text-[11px] text-text-muted">
          {sym?.spread != null ? `Live spread ${sym.spread} pts. ` : ""}
          The tester uses the broker's recorded historical spread{draft.Model === "4" ? " tick by tick" : " per bar"}; it can't be overridden.
          {symbols?.refreshed ? "" : " Symbol list not read from MT5 yet: press ↻ (MT5 must be closed)."}
        </p>
        {dirty && <span className="text-[11px] text-amber-500">changed, not run yet</span>}
        <button type="button" onClick={() => setLiveOpen(true)} disabled={mt5 === "testing" || mt5 === "symbols"}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary disabled:opacity-40 focus-ring">
          <Radio className="h-3.5 w-3.5" /> Go live
        </button>
        <MorphingButton status={status} onClick={run} disabled={mt5 !== "ready" && !running}
          idleText={!hasRuns ? "Run backtest" : dirty ? "Run with these" : "Run again"} loadingText="Backtesting…" successText="Done" errorText="Not started"
          idleIcon={<Play className="h-3.5 w-3.5" />} />
      </div>

      <GoLiveSheet open={liveOpen} onOpenChange={setLiveOpen} strategy={strategy} settings={draft}
        inputs={inputs.map((i) => ({ ...i, value: values[i.name] ?? i.value }))}
        onStarted={() => setSaved({ settings: draft, inputs: values })} />
    </div>
  );
}
