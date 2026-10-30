// Checks a backtest against the account rules it ran with, using the daily
// log Risk.mqh writes in the tester (studio_daily.csv): day-start balance
// and equity, the day's lowest and highest equity (floating P&L included),
// end of day values and trades. Generic: no firm is hardcoded, the rules
// are whatever the strategy's "Risk & rules" inputs were.

export type PropCheck = {
  size: number;
  daily: { limitPct: number; worstPct: number; worstDay: string | null; breaches: string[] } | null;
  maxLoss: { limitPct: number; type: number; worstPct: number; worstDay: string | null; breachDay: string | null } | null;
  target: { pct: number; hitDay: string | null } | null;
  tradingDays: number;
  days: number;
  passed: boolean;
};

type Day = { day: string; sb: number; se: number; min: number; max: number; eb: number; ee: number; trades: number };

export function propCheck(csv: string): PropCheck | null {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const rules = lines.find((l) => l.startsWith("#rules"))?.split(",").map(Number);
  if (!rules) return null;
  const [, size, dailyPct, dailyOf, startValue, , maxPct, maxType, targetPct] = rules;
  const days: Day[] = lines.filter((l) => /^\d{4}\.\d{2}\.\d{2},/.test(l)).map((l) => {
    const [day, sb, se, min, max, eb, ee, trades] = l.split(",");
    return { day, sb: +sb, se: +se, min: +min, max: +max, eb: +eb, ee: +ee, trades: +trades };
  });
  if (!days.length) return null;

  let daily: PropCheck["daily"] = null;
  if (dailyPct > 0) {
    daily = { limitPct: dailyPct, worstPct: 0, worstDay: null, breaches: [] };
    for (const d of days) {
      const start = startValue === 0 ? d.sb : startValue === 1 ? d.se : Math.max(d.sb, d.se);
      const base = dailyOf === 0 ? size : start;
      // loss as a % of the same base the limit uses
      const lossPct = ((start - d.min) / base) * 100;
      if (lossPct > daily.worstPct) { daily.worstPct = lossPct; daily.worstDay = d.day; }
      if (lossPct >= dailyPct) daily.breaches.push(d.day);
    }
  }

  let maxLoss: PropCheck["maxLoss"] = null;
  if (maxPct > 0) {
    maxLoss = { limitPct: maxPct, type: maxType, worstPct: 0, worstDay: null, breachDay: null };
    // trailing floors follow the highest equity seen before the day's low;
    // within one day the order of high and low is unknown, so the day's
    // own high is only counted from the next day on (the lenient reading)
    let peak = size;
    for (const d of days) {
      peak = Math.max(peak, d.se);
      const floor = maxType === 0 ? size - size * maxPct / 100
        : maxType === 1 ? peak - size * maxPct / 100
        : Math.min(peak - size * maxPct / 100, size);
      const usedPct = ((floor + size * maxPct / 100 - d.min) / size) * 100;
      if (usedPct > maxLoss.worstPct) { maxLoss.worstPct = usedPct; maxLoss.worstDay = d.day; }
      if (d.min <= floor && !maxLoss.breachDay) maxLoss.breachDay = d.day;
      peak = Math.max(peak, d.max);
    }
  }

  let target: PropCheck["target"] = null;
  if (targetPct > 0) {
    const hit = days.find((d) => d.eb >= size * (1 + targetPct / 100));
    target = { pct: targetPct, hitDay: hit?.day ?? null };
  }

  return {
    size, daily, maxLoss, target,
    tradingDays: days.filter((d) => d.trades > 0).length,
    days: days.length,
    passed: !(daily?.breaches.length) && !maxLoss?.breachDay,
  };
}
