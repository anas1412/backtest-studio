// Parses the MT5 Strategy Tester HTML report (already decoded to UTF-8)
// into summary stats, deals, FIFO-matched trades and a balance curve.

export type Deal = {
  time: string; deal: string; symbol: string; type: string; direction: string;
  volume: number; price: number; commission: number; swap: number; profit: number;
  balance: number; comment: string;
};
export type Trade = {
  symbol: string; side: string; volume: number;
  entryTime: string; entryPrice: number; exitTime: string; exitPrice: number;
  profit: number; balance: number;
};

const num = (s: string) => Number(s.replace(/[\s ]/g, "").replace(/[^\d.+-]/g, "")) || 0;

function decode(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function rows(html: string): string[][] {
  const out: string[][] = [];
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    out.push([...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => decode(c[1])));
  }
  return out;
}

export function parseReport(html: string) {
  const all = rows(html);
  const summary: Record<string, string> = {};
  for (const r of all) {
    for (let i = 0; i < r.length - 1; i++) {
      if (r[i].endsWith(":") && r[i + 1] && !(r[i] in summary)) summary[r[i].slice(0, -1)] = r[i + 1];
    }
  }

  const deals: Deal[] = [];
  const head = all.findIndex((r) => r[0] === "Time" && r[1] === "Deal" && r[2] === "Symbol");
  if (head >= 0) {
    const cols = all[head];
    const at = (r: string[], name: string) => r[cols.indexOf(name)] ?? "";
    for (const r of all.slice(head + 1)) {
      if (r.length !== cols.length) break;
      deals.push({
        time: at(r, "Time"), deal: at(r, "Deal"), symbol: at(r, "Symbol"),
        type: at(r, "Type"), direction: at(r, "Direction"), volume: num(at(r, "Volume")),
        price: num(at(r, "Price")), commission: num(at(r, "Commission")), swap: num(at(r, "Swap")),
        profit: num(at(r, "Profit")), balance: num(at(r, "Balance")), comment: at(r, "Comment"),
      });
    }
  }
  return { summary, deals, trades: matchTrades(deals) };
}

function matchTrades(deals: Deal[]): Trade[] {
  const open = new Map<string, Deal[]>();
  const trades: Trade[] = [];
  for (const d of deals) {
    if (d.direction === "in") {
      open.set(d.symbol, [...(open.get(d.symbol) ?? []), d]);
    } else if (d.direction === "out" || d.direction === "in/out") {
      const entry = open.get(d.symbol)?.shift();
      trades.push({
        symbol: d.symbol, side: entry?.type ?? (d.type === "sell" ? "buy" : "sell"), volume: d.volume,
        entryTime: entry?.time ?? d.time, entryPrice: entry?.price ?? d.price,
        exitTime: d.time, exitPrice: d.price, balance: d.balance,
        profit: Math.round((d.profit + d.commission + d.swap + (entry?.commission ?? 0)) * 100) / 100,
      });
    }
  }
  return trades;
}

// "2025.01.02 10:00[:00]" broker time -> unix seconds, shown as-is on the chart
export function brokerTime(s: string): number {
  const m = s.match(/(\d{4})\.(\d{2})\.(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)) / 1000;
}

export function parseBars(csv: string) {
  return csv.split(/\r?\n/).slice(1).filter(Boolean).map((l) => {
    const [t, o, h, lo, c] = l.split(",");
    return { time: brokerTime(t), open: +o, high: +h, low: +lo, close: +c };
  });
}
