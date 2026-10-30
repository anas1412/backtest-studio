import { Badge } from "@/components/ui/badge";
import type { PropCheck } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_TYPES = ["static", "trailing", "trailing until account size"];

// One rule: how much of the limit the worst day used, as a bar.
function Rule({ label, detail, used, limit, breached }: { label: string; detail: string; used: number; limit: number; breached: boolean }) {
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium">{label}</span>
        <span className={cn("tabular-nums", breached ? "text-rose-500" : "text-text-secondary")}>
          worst {used.toFixed(2)}% of {limit}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-hover">
        <div className={cn("h-full rounded-full", breached ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-text-muted">{detail}</p>
    </div>
  );
}

// Did this run respect the account rules it was given? Generic: the rules
// are the strategy's "Risk & rules" inputs, whatever firm they describe.
export function PropCheckCard({ prop }: { prop: PropCheck }) {
  const anyRule = prop.daily || prop.maxLoss || prop.target;
  if (!anyRule) return null;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Account rules</h3>
          <p className="text-[11px] text-text-muted">
            ${prop.size.toLocaleString()} account · {prop.tradingDays} trading days of {prop.days} · floating losses included
          </p>
        </div>
        <Badge tone={prop.passed ? "success" : "danger"} dot>{prop.passed ? "No breach" : "Breached"}</Badge>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))" }}>
        {prop.daily && (
          <Rule label="Daily loss" used={prop.daily.worstPct} limit={prop.daily.limitPct} breached={prop.daily.breaches.length > 0}
            detail={prop.daily.breaches.length
              ? `Breached on ${prop.daily.breaches.map(shortDate).join(", ")}`
              : prop.daily.worstDay ? `Worst day ${shortDate(prop.daily.worstDay)}` : "No losing day"} />
        )}
        {prop.maxLoss && (
          <Rule label={`Max loss (${MAX_TYPES[prop.maxLoss.type] ?? ""})`} used={prop.maxLoss.worstPct} limit={prop.maxLoss.limitPct}
            breached={!!prop.maxLoss.breachDay}
            detail={prop.maxLoss.breachDay ? `Breached on ${shortDate(prop.maxLoss.breachDay)}`
              : prop.maxLoss.worstDay ? `Closest on ${shortDate(prop.maxLoss.worstDay)}` : "Never below the start"} />
        )}
        {prop.target && (
          <div className="text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">Profit target</span>
              <span className="tabular-nums text-text-secondary">{prop.target.pct}%</span>
            </div>
            <p className={cn("mt-2", prop.target.hitDay ? "text-emerald-500" : "text-text-muted")}>
              {prop.target.hitDay ? `Reached on ${shortDate(prop.target.hitDay)}` : "Not reached in this test"}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
