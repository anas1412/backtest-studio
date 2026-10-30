import { useMemo } from "react";
import { InteractiveAreaChart, type AreaChartData } from "@/components/ui/interactive-area-chart";
import type { Deal } from "@/lib/types";
import { brokerTime } from "@/lib/format";

const DAY = 86_400_000;
const RANGES: [string, number][] = [["1M", 30 * DAY], ["3M", 91 * DAY], ["1Y", 365 * DAY]];

// Balance after the deposit and after every closing deal, one point per time.
export function EquityChart({ deals }: { deals: Deal[] }) {
  const data = useMemo<AreaChartData>(() => {
    const pts = new Map<number, number>();
    for (const d of deals) {
      if (d.type === "balance" || d.direction === "out" || d.direction === "in/out") pts.set(brokerTime(d.time) * 1000, d.balance);
    }
    const all = [...pts].sort((a, b) => a[0] - b[0]).map(([date, value]) => ({ date, value }));
    if (all.length < 2) return {};
    const end = all[all.length - 1].date;
    const out: AreaChartData = {};
    // only ranges shorter than the test, each with enough points to draw
    for (const [k, span] of RANGES) {
      const sub = all.filter((p) => p.date >= end - span);
      if (end - all[0].date > span && sub.length >= 2) out[k] = sub;
    }
    out.All = all;
    return out;
  }, [deals]);

  if (!data.All) return null;
  return <InteractiveAreaChart data={data} defaultRange="All" title="Balance" height={260} />;
}
