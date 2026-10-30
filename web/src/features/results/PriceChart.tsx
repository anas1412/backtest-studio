import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, type SeriesMarker, type Time, type UTCTimestamp } from "lightweight-charts";
import type { Bar, Deal } from "@/lib/types";
import { brokerTime } from "@/lib/format";
import { useThemeTokens } from "@/hooks/use-theme-tokens";

export const UP = "#34d399";
export const DOWN = "#fb7185";

// markers must sit on an existing bar: snap to the bar that contains the time
function snap(times: number[], x: number) {
  let lo = 0, hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= x) lo = mid; else hi = mid - 1;
  }
  return times[lo];
}

export type Focus = { from: number; to: number } | null;

export function PriceChart({ bars, deals, focus }: { bars: Bar[]; deals: Deal[]; focus: Focus }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const t = useThemeTokens();

  useEffect(() => {
    const c = createChart(el.current!, { autoSize: true, timeScale: { timeVisible: true, borderVisible: false }, rightPriceScale: { borderVisible: false } });
    series.current = c.addCandlestickSeries({
      upColor: UP, downColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, borderVisible: false,
    });
    chart.current = c;
    return () => c.remove();
  }, []);

  useEffect(() => {
    chart.current?.applyOptions({
      layout: { background: { color: "transparent" }, textColor: t.text, fontFamily: "Geist Variable, sans-serif" },
      grid: { vertLines: { visible: false }, horzLines: { color: t.border } },
      crosshair: { vertLine: { labelBackgroundColor: t.surface }, horzLine: { labelBackgroundColor: t.surface } },
    });
  }, [t]);

  useEffect(() => {
    const s = series.current!;
    s.setData(bars.map((b) => ({ ...b, time: b.time as UTCTimestamp })));
    const times = bars.map((b) => b.time);
    const markers: SeriesMarker<Time>[] = [];
    if (times.length) {
      for (const d of deals) {
        if (d.direction !== "in" && d.direction !== "out") continue;
        const buy = d.type === "buy";
        markers.push({
          time: snap(times, brokerTime(d.time)) as UTCTimestamp,
          position: buy ? "belowBar" : "aboveBar",
          shape: d.direction === "in" ? (buy ? "arrowUp" : "arrowDown") : "circle",
          color: d.direction === "in" ? (buy ? UP : DOWN) : (d.profit >= 0 ? UP : DOWN),
          size: d.direction === "in" ? 1 : 0.6,
        });
      }
    }
    s.setMarkers(markers.sort((a, b) => (a.time as number) - (b.time as number)));
    requestAnimationFrame(() => chart.current?.timeScale().fitContent());
  }, [bars, deals]);

  useEffect(() => {
    if (focus) chart.current?.timeScale().setVisibleRange({ from: focus.from as UTCTimestamp, to: focus.to as UTCTimestamp });
  }, [focus]);

  return <div ref={el} className="h-full w-full" />;
}
