// MT5 report values are strings like "10 000.00", "451.04 (4.46%)", "10 (27.03%)".

export const num = (s?: string) => Number((s ?? "").split("(")[0].replace(/[\s ]/g, "")) || 0;
export const pct = (s?: string) => Number((s ?? "").match(/\(([-\d.]+)%\)/)?.[1] ?? 0);

// "2026.06.02 06:00:00" broker time -> unix seconds, shown as-is (labelled UTC by the charts)
export function brokerTime(s: string): number {
  const m = s.match(/(\d{4})\.(\d{2})\.(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)) / 1000;
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

// "20261030-095137-ema_cross_20_50" -> "Oct 30, 09:51"
export function runTime(id: string): string {
  const m = id.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
  if (!m) return id;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export const shortDate = (s?: string) => (s ?? "").replace(/^(\d{4})\.(\d{2})\.(\d{2}).*/, "$3.$2.$1");
