// Fixed MT5 vocabularies. Every timeframe is built from the same M1 history,
// so all of them work for any symbol that has history.

export const TIMEFRAMES = [
  "M1", "M2", "M3", "M4", "M5", "M6", "M10", "M12", "M15", "M20", "M30",
  "H1", "H2", "H3", "H4", "H6", "H8", "H12", "D1", "W1", "MN1",
];

export const TICK_MODELS = [
  { value: "4", label: "Real ticks", description: "Broker's recorded ticks and spread. Most accurate, slowest" },
  { value: "0", label: "Every tick", description: "Ticks generated from M1 bars" },
  { value: "1", label: "1-minute OHLC", description: "4 prices per M1 bar. Fast, good for bar-close logic" },
  { value: "2", label: "Open prices", description: "One price per bar. Fastest, only for open-of-bar logic" },
];

// "2026.06.01" <-> local-midnight Date
export const iniToDate = (s: string) => {
  const m = s.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
export const dateToIni = (d: Date) =>
  `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;

// Quick date ranges, all ending today. "max" starts at the symbol's first
// year of downloaded history.
export const RANGE_PRESETS = [
  { value: "1m", label: "Last month", months: 1 },
  { value: "3m", label: "Last 3 months", months: 3 },
  { value: "6m", label: "Last 6 months", months: 6 },
  { value: "ytd", label: "Year to date", months: 0 },
  { value: "1y", label: "Last year", months: 12 },
  { value: "2y", label: "Last 2 years", months: 24 },
  { value: "3y", label: "Last 3 years", months: 36 },
  { value: "5y", label: "Last 5 years", months: 60 },
  { value: "max", label: "All history", months: 0 },
];

export function presetRange(value: string, historyStart?: number): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(0, 0, 0, 0);
  const from = new Date(to);
  const p = RANGE_PRESETS.find((x) => x.value === value);
  if (value === "ytd") from.setMonth(0, 1);
  else if (value === "max") from.setFullYear(historyStart ?? to.getFullYear() - 5, 0, 1);
  else from.setMonth(from.getMonth() - (p?.months ?? 12));
  return { from, to };
}

// Which preset a range matches exactly, if any (for showing its name).
export function matchPreset(from: Date | null, to: Date | null, historyStart?: number): string {
  if (!from || !to) return "custom";
  const same = (a: Date, b: Date) => dateToIni(a) === dateToIni(b);
  return RANGE_PRESETS.find((p) => {
    const r = presetRange(p.value, historyStart);
    return same(r.from, from) && same(r.to, to);
  })?.value ?? "custom";
}
