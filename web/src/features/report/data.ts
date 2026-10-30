// Everything the PDF report shows, worked out from a run (MT5's report
// summary, the trades, the bars) and its report extras (the inputs it used,
// the risk module's daily log). No layout here: see ReportDocument.
import type { PropCheck, Run, RunReport, StrategyInput, Trade } from "@/lib/types";
import { TICK_MODELS } from "@/lib/mt5";

export type Tone = "up" | "down" | "plain";
export type Kpi = { label: string; value: string; note: string; tone: Tone };
export type Row = [label: string, value: string];
export type Point = { t: number; v: number };
export type Mark = { t: number; price: number; kind: "buy" | "sell" | "exit" };
export type MonthRow = { year: number; months: (number | null)[]; total: number | null };
export type InputRow = { label: string; value: string };

export type ReportData = {
  strategy: string; subtitle: string; runId: string; generated: string; currency: string;
  meta: Row[];
  kpis: Kpi[];
  details: { title: string; rows: Row[] }[];
  balance: Point[];
  drawdown: Point[]; // % below the high, ≤ 0
  drawdownFromEquity: boolean;
  monthly: MonthRow[];
  price: Point[];
  marks: Mark[] | null; // null: too many trades to mark
  prop: PropCheck | null;
  inputs: { title: string; rows: InputRow[] }[];
  trades: Trade[];
  source: string | null;
};

// The PDF's built-in font (Helvetica) only has Western European characters.
export const clean = (s: string) =>
  s.replace(/[→⇒]/g, "->").replace(/[←]/g, "<-").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/σ/g, "sd")
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff€–—•…·]/g, "?");

// MT5 writes "10 000.00" and "799.73 (7.66%)"
const num = (s?: string) => {
  const m = s?.replace(/(\d)\s(?=\d)/g, "$1").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const tidy = (s?: string) => (s ? s.replace(/(\d)\s(?=\d{3}\b)/g, "$1,") : "–");

export const money = (n: number, cur = "") =>
  `${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ` ${cur}` : ""}`;
export const pct = (n: number, digits = 2) => `${n.toFixed(digits)}%`;
const signed = (n: number, f: (n: number) => string) => (n > 0 ? `+${f(n)}` : f(n));

// broker time "2026.06.01 14:20:00" as a UTC timestamp (the clock is the broker's)
export const ms = (t: string) => {
  const [d, h = "0:0:0"] = t.trim().split(" ");
  const [y, mo, da] = d.split(".").map(Number);
  const [hh = 0, mi = 0, ss = 0] = h.split(":").map(Number);
  return Date.UTC(y, mo - 1, da, hh, mi, ss);
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const day = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const monthName = (i: number) => MONTHS[i];

function inputValue(i: StrategyInput) {
  const opt = i.options?.find((o) => o.value === i.value);
  if (opt) return opt.label;
  if (i.type === "bool") return i.value === "true" || i.value === "1" ? "Yes" : "No";
  return i.value;
}

// Balance after each trade; the deposit first.
function balanceCurve(trades: Trade[], deposit: number, start: number): Point[] {
  const pts: Point[] = [{ t: start, v: deposit }];
  for (const t of [...trades].sort((a, b) => ms(a.exitTime) - ms(b.exitTime))) pts.push({ t: ms(t.exitTime), v: t.balance });
  return pts;
}

// How far below its high the account was: per day from the daily equity log
// (floating losses included) when there is one, else per trade from the balance.
function drawdowns(balance: Point[], daily: RunReport["daily"]): { points: Point[]; fromEquity: boolean } {
  if (daily.length) {
    let peak = 0;
    const points = daily.map((d) => {
      peak = Math.max(peak, d.startEquity, d.startBalance);
      const dd = peak > 0 ? ((d.minEquity - peak) / peak) * 100 : 0;
      peak = Math.max(peak, d.maxEquity);
      return { t: ms(d.day), v: Math.min(0, dd) };
    });
    return { points, fromEquity: true };
  }
  let peak = 0;
  return { points: balance.map((p) => { peak = Math.max(peak, p.v); return { t: p.t, v: peak > 0 ? ((p.v - peak) / peak) * 100 : 0 }; }), fromEquity: false };
}

// Return per calendar month (by exit time), from the balance before the
// month's first trade to the balance after its last.
function monthlyReturns(trades: Trade[]): MonthRow[] {
  const byMonth = new Map<string, { first: number; last: number }>();
  for (const t of [...trades].sort((a, b) => ms(a.exitTime) - ms(b.exitTime))) {
    const key = t.exitTime.slice(0, 7); // "2026.06"
    const m = byMonth.get(key);
    if (m) m.last = t.balance;
    else byMonth.set(key, { first: t.balance - t.profit, last: t.balance });
  }
  const years = [...new Set([...byMonth.keys()].map((k) => Number(k.slice(0, 4))))].sort();
  return years.map((year) => {
    const months = MONTHS.map((_, i) => {
      const m = byMonth.get(`${year}.${String(i + 1).padStart(2, "0")}`);
      return m && m.first > 0 ? ((m.last - m.first) / m.first) * 100 : null;
    });
    const inYear = [...byMonth].filter(([k]) => k.startsWith(`${year}.`)).map(([, v]) => v);
    const total = inYear.length && inYear[0].first > 0 ? ((inYear[inYear.length - 1].last - inYear[0].first) / inYear[0].first) * 100 : null;
    return { year, months, total };
  });
}

// At most `max` points of the close, keeping each bucket's last close.
function downsample(bars: Run["bars"], max: number): Point[] {
  const step = Math.max(1, Math.ceil(bars.length / max));
  const out: Point[] = [];
  for (let i = step - 1; i < bars.length; i += step) out.push({ t: bars[i].time * 1000, v: bars[i].close });
  if (bars.length && out[out.length - 1]?.t !== bars[bars.length - 1].time * 1000) out.push({ t: bars[bars.length - 1].time * 1000, v: bars[bars.length - 1].close });
  return out;
}

export function reportData(run: Run, extra: RunReport, includeCode: boolean): ReportData {
  const s = run.summary;
  const t = run.meta.tester;
  const cur = s.Currency || t.Currency || "";
  const deposit = num(s["Initial Deposit"]) ?? Number(t.Deposit) ?? 0;
  const net = num(s["Total Net Profit"]) ?? 0;
  const total = num(s["Total Trades"]) ?? run.trades.length;
  const wins = num(s["Profit Trades (% of total)"]) ?? 0;
  const dd = s["Equity Drawdown Maximal"]?.match(/\(([\d.]+)%\)/)?.[1];
  const from = ms(t.FromDate), to = ms(t.ToDate);
  const model = TICK_MODELS.find((m) => m.value === t.Model)?.label ?? `Model ${t.Model}`;
  const balance = balanceCurve(run.trades, deposit, from);
  const { points: drawdown, fromEquity } = drawdowns(balance, extra.daily);
  const pf = num(s["Profit Factor"]);

  const groups = new Map<string, InputRow[]>();
  for (const i of extra.inputs) {
    const title = i.group === "Strategy" || i.group === "Risk & rules" ? i.group : "Advanced";
    groups.set(title, [...(groups.get(title) ?? []), { label: clean(i.comment || i.name), value: clean(inputValue(i)) }]);
  }

  return {
    strategy: clean(run.meta.strategy),
    subtitle: `${t.Symbol} · ${t.Period} · ${day(from)} – ${day(to)}`,
    runId: run.meta.id,
    generated: day(Date.now()),
    currency: cur,
    meta: [
      ["Broker", clean(s.Company || "–")],
      ["Initial deposit", money(deposit, cur)],
      ["Leverage", s.Leverage || t.Leverage || "–"],
      ["Tick model", model],
      ["History quality", s["History Quality"] || "–"],
      ["Average spread", run.avgSpread !== null ? `${run.avgSpread} points` : "–"],
      ["Bars / ticks", `${tidy(s.Bars)} / ${tidy(s.Ticks)}`],
      ["Tested on", run.meta.finished ? day(new Date(run.meta.finished).getTime()) : day(new Date(run.meta.started).getTime())],
    ],
    kpis: [
      { label: "Net profit", value: signed(net, (n) => money(n, cur)), note: `${signed(deposit ? (net / deposit) * 100 : 0, (n) => pct(n))} on the deposit`, tone: net > 0 ? "up" : net < 0 ? "down" : "plain" },
      { label: "Profit factor", value: pf !== null ? pf.toFixed(2) : "–", note: "gross profit / gross loss", tone: pf === null ? "plain" : pf >= 1 ? "up" : "down" },
      { label: "Win rate", value: total ? pct((wins / total) * 100, 1) : "–", note: `${wins} of ${total} trades`, tone: "plain" },
      { label: "Max drawdown", value: dd ? `${dd}%` : "–", note: `equity, ${tidy(s["Equity Drawdown Maximal"]?.split(" (")[0])} ${cur}`, tone: "down" },
      { label: "Expected payoff", value: tidy(s["Expected Payoff"]), note: `per trade, ${cur}`, tone: "plain" },
      { label: "Sharpe ratio", value: tidy(s["Sharpe Ratio"]), note: "as MT5 computes it", tone: "plain" },
      { label: "Recovery factor", value: tidy(s["Recovery Factor"]), note: "net profit / max drawdown", tone: "plain" },
      { label: "Trades", value: String(total), note: `${num(s["Long Trades (won %)"]) ?? 0} long · ${num(s["Short Trades (won %)"]) ?? 0} short`, tone: "plain" },
    ],
    details: [
      { title: "Profitability", rows: [
        ["Gross profit", tidy(s["Gross Profit"])], ["Gross loss", tidy(s["Gross Loss"])], ["Net profit", tidy(s["Total Net Profit"])],
        ["Profit factor", tidy(s["Profit Factor"])], ["Expected payoff", tidy(s["Expected Payoff"])],
        ["Return on deposit", deposit ? pct((net / deposit) * 100) : "–"],
      ] },
      { title: "Risk", rows: [
        ["Max equity drawdown", tidy(s["Equity Drawdown Maximal"])], ["Max balance drawdown", tidy(s["Balance Drawdown Maximal"])],
        ["Equity drawdown below the deposit", tidy(s["Equity Drawdown Absolute"])], ["Recovery factor", tidy(s["Recovery Factor"])],
        ["Sharpe ratio", tidy(s["Sharpe Ratio"])], ["Lowest margin level", tidy(s["Margin Level"])],
      ] },
      { title: "Trades", rows: [
        ["Total trades", tidy(s["Total Trades"])], ["Long trades (won %)", tidy(s["Long Trades (won %)"])],
        ["Short trades (won %)", tidy(s["Short Trades (won %)"])], ["Winning trades", tidy(s["Profit Trades (% of total)"])],
        ["Losing trades", tidy(s["Loss Trades (% of total)"])], ["Largest win", tidy(s["Largest profit trade"])],
        ["Largest loss", tidy(s["Largest loss trade"])], ["Average win", tidy(s["Average profit trade"])],
        ["Average loss", tidy(s["Average loss trade"])],
      ] },
      { title: "Streaks and holding time", rows: [
        ["Most wins in a row", tidy(s["Maximum consecutive wins ($)"])], ["Most losses in a row", tidy(s["Maximum consecutive losses ($)"])],
        ["Average winning streak", tidy(s["Average consecutive wins"])], ["Average losing streak", tidy(s["Average consecutive losses"])],
        ["Shortest trade", tidy(s["Minimal position holding time"])], ["Longest trade", tidy(s["Maximal position holding time"])],
        ["Average trade", tidy(s["Average position holding time"])],
      ] },
    ],
    balance,
    drawdown,
    drawdownFromEquity: fromEquity,
    monthly: monthlyReturns(run.trades),
    price: downsample(run.bars, 500),
    marks: run.trades.length > 400 ? null : run.trades.flatMap((tr): Mark[] => [
      { t: ms(tr.entryTime), price: tr.entryPrice, kind: tr.side === "sell" ? "sell" : "buy" },
      { t: ms(tr.exitTime), price: tr.exitPrice, kind: "exit" },
    ]),
    prop: run.prop,
    inputs: ["Risk & rules", "Strategy", "Advanced"].filter((g) => groups.has(g)).map((g) => ({ title: g, rows: groups.get(g)! })),
    trades: run.trades,
    source: includeCode && extra.source ? clean(extra.source) : null,
  };
}
