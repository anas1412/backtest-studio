import { useMemo } from "react";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import type { RunSummary } from "@/lib/api";
import type { Trade } from "@/lib/types";
import { money, num, pct } from "@/lib/format";
import { UP, DOWN } from "./PriceChart";

// Per-trade running series so each card's sparkline scrubs in its own unit.
function series(trades: Trade[], deposit: number) {
  let pnl = 0, wins = 0, gp = 0, gl = 0, peak = deposit;
  const out = { pnl: [0], win: [0], pf: [0], dd: [0] };
  trades.forEach((t, i) => {
    pnl += t.profit;
    if (t.profit > 0) { wins++; gp += t.profit; } else gl -= t.profit;
    peak = Math.max(peak, t.balance);
    out.pnl.push(Math.round(pnl * 100) / 100);
    out.win.push((wins / (i + 1)) * 100);
    out.pf.push(gl ? Math.min(gp / gl, 10) : gp ? 10 : 0);
    out.dd.push(peak ? ((peak - t.balance) / peak) * 100 : 0);
  });
  return out;
}

// Deltas compare with the previous run of the same strategy, so iterating
// on a strategy shows whether the change helped.
export function StatsRow({ summary, trades, prev }: { summary: Record<string, string>; trades: Trade[]; prev?: RunSummary }) {
  const deposit = num(summary["Initial Deposit"]) || 10000;
  const s = useMemo(() => series(trades, deposit), [trades, deposit]);
  const labels = ["Start", ...trades.map((t) => t.exitTime.slice(0, 16))];
  const net = num(summary["Total Net Profit"]);
  const pf = num(summary["Profit Factor"]);
  const win = pct(summary["Profit Trades (% of total)"]);
  const dd = pct(summary["Equity Drawdown Maximal"]);
  const vs = prev ? "vs previous run" : "first run of this strategy";

  return (
    <StatGrid>
      <StatCard label="Net profit" value={net} trend={s.pnl} trendLabels={labels}
        previous={prev ? num(prev.net) : undefined} delta={prev ? undefined : (net / deposit) * 100}
        period={prev ? vs : `on ${money(deposit)} deposit`} format={money} color={net >= 0 ? UP : DOWN} />
      <StatCard label="Profit factor" value={pf} trend={s.pf} trendLabels={labels}
        previous={prev ? num(prev.pf) : undefined} delta={prev ? undefined : 0}
        period={vs} format={(n) => n.toFixed(2)} />
      <StatCard label="Win rate" value={win} trend={s.win} trendLabels={labels}
        previous={prev ? pct(prev.win) : undefined} delta={prev ? undefined : 0}
        period={`${num(summary["Profit Trades (% of total)"])} of ${trades.length} trades`} format={(n) => `${n.toFixed(1)}%`} />
      <StatCard label="Max drawdown" value={dd} trend={s.dd} trendLabels={labels} goodWhen="down"
        previous={prev ? pct(prev.dd) : undefined} delta={prev ? undefined : 0}
        period={`equity · ${money(num(summary["Equity Drawdown Maximal"]))}`} format={(n) => `${n.toFixed(2)}%`} color={DOWN} />
    </StatGrid>
  );
}
