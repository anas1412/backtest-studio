import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { useStudio } from "@/lib/api";
import { num, runTime } from "@/lib/format";
import { Logo } from "./Logo";

const MT5 = {
  ready: { tone: "success", label: "MT5 ready", pulse: false },
  testing: { tone: "warning", label: "Backtesting…", pulse: true },
  "gui-open": { tone: "danger", label: "MT5 open · close to test", pulse: false },
} as const;

export function TopBar({ runId, onRunChange }: { runId: string | null; onRunChange: (id: string) => void }) {
  const runs = useStudio((s) => s.runs);
  const mt5 = useStudio((s) => s.mt5);
  const connected = useStudio((s) => s.connected);
  const m = MT5[mt5];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Logo />
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-semibold tracking-tight">Backtest Studio</p>
          <p className="text-[11px] text-text-muted">MetaTrader 5 · Claude</p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        {runs.length > 0 && (
          <Combobox
            className="w-40 sm:w-72"
            aria-label="Open a run"
            value={runId}
            onValueChange={(v) => v && onRunChange(v)}
            placeholder="Open a run…"
            searchPlaceholder="Search strategies, symbols…"
            align="end"
            options={runs.map((r) => ({
              value: r.id,
              label: r.strategy,
              description: `${r.tester.Symbol} ${r.tester.Period} · ${runTime(r.id)}${r.status === "done" ? ` · ${num(r.net) >= 0 ? "+" : ""}${r.net}` : ` · ${r.status}`}`,
              keywords: [r.tester.Symbol, r.tester.Period, r.id],
            }))}
          />
        )}
        {connected
          ? <Badge tone={m.tone} dot pulse={m.pulse}>{m.label}</Badge>
          : <Badge tone="danger" dot>Server offline</Badge>}
      </div>
    </header>
  );
}
