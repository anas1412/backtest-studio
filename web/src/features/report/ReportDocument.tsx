// The PDF report's layout (react-pdf): A4, light, built-in Helvetica.
// Page 1 summary and equity, page 2 details, monthly returns and the price
// chart, then the settings, every trade, and optionally the code.
import { Document, Page, View, Text, Svg, Polyline, Polygon, Line, Circle, StyleSheet } from "@react-pdf/renderer";
import { Fragment, type ReactNode } from "react";
import { type Point, type ReportData, type Tone, day, money, monthName, pct } from "./data";

const C = {
  text: "#0f172a", muted: "#64748b", faint: "#94a3b8", border: "#e2e8f0", soft: "#f8fafc",
  up: "#059669", down: "#e11d48", line: "#4f46e5", fill: "#eef2ff", price: "#334155",
};
const tone = (t: Tone) => (t === "up" ? C.up : t === "down" ? C.down : C.text);

const st = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: C.text },
  brand: { flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted, letterSpacing: 0.8, marginBottom: 14 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 22 },
  subtitle: { fontSize: 11, color: C.muted, marginTop: 4 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 6, marginTop: 18 },
  note: { fontSize: 7.5, color: C.muted, marginTop: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  card: { width: "25%", padding: 3 },
  cardIn: { border: `0.75pt solid ${C.border}`, borderRadius: 4, padding: 8, height: 58 },
  label: { fontSize: 7.5, color: C.muted },
  kpi: { fontFamily: "Helvetica-Bold", fontSize: 15, marginTop: 4 },
  meta: { width: "25%", paddingVertical: 4, paddingRight: 6 },
  metaValue: { fontSize: 9, marginTop: 2 },
  row: { flexDirection: "row", borderBottom: `0.5pt solid ${C.border}`, paddingVertical: 3.5 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: C.faint },
});

function Footer({ data }: { data: ReportData }) {
  return (
    <View style={st.footer} fixed>
      <Text>Backtest Studio · {data.strategy} · run {data.runId}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function Brand({ data }: { data: ReportData }) {
  return (
    <View style={st.brand}>
      <Text>BACKTEST STUDIO · BACKTEST REPORT</Text>
      <Text>Generated {data.generated}</Text>
    </View>
  );
}

// Labelled rows in two columns: label left, value right.
function Table({ rows, width = "100%" }: { rows: [string, string][]; width?: string }) {
  return (
    <View style={{ width }}>
      {rows.map(([l, v], i) => (
        <View key={i} style={st.row} wrap={false}>
          <Text style={{ flex: 1, color: C.muted }}>{l}</Text>
          <Text style={{ textAlign: "right" }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

// round axis values: steps of 1, 2, 2.5 or 5 times a power of ten
function nice(lo: number, hi: number) {
  const raw = (hi - lo || Math.abs(hi) || 1) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v < hi + step * 0.999; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

// A line chart drawn as vector graphics, with y labels on the right and the
// first, middle and last dates under it.
function Chart({ points, height, color, area, format, children, yMin, yMax, label = day }: {
  points: Point[]; height: number; color: string; area?: boolean; format: (v: number) => string;
  children?: (x: (t: number) => number, y: (v: number) => number) => ReactNode; yMin?: number; yMax?: number;
  label?: (t: number) => string; // x axis text for a point's t
}) {
  const W = 455, H = height;
  if (points.length < 2) return <Text style={st.note}>Not enough data to draw.</Text>;
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const lo = yMin ?? Math.min(...points.map((p) => p.v)), hi = yMax ?? Math.max(...points.map((p) => p.v));
  const ticks = nice(yMin ?? lo, yMax ?? hi);
  const [a, b] = [yMin ?? ticks[0], yMax ?? ticks[ticks.length - 1]];
  const x = (t: number) => (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * W);
  const y = (v: number) => H - ((v - a) / (b - a)) * H;
  const line = points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        <Svg width={W} height={H}>
          {ticks.map((v, i) => <Line key={i} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={C.border} strokeWidth={0.5} />)}
          {area && <Polygon points={`0,${y(Math.max(a, Math.min(0, b)))} ${line} ${W},${y(Math.max(a, Math.min(0, b)))}`} fill={color} fillOpacity={0.12} />}
          <Polyline points={line} stroke={color} strokeWidth={1} fill="none" />
          {children?.(x, y)}
        </Svg>
        <View style={{ width: 60, height: H, position: "relative" }}>
          {ticks.map((v, i) => (
            <Text key={i} style={{ position: "absolute", left: 6, top: y(v) - 4, fontSize: 6.5, color: C.muted }}>{format(v)}</Text>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: W, marginTop: 3, fontSize: 6.5, color: C.muted }}>
        <Text>{label(t0)}</Text><Text>{label((t0 + t1) / 2)}</Text><Text>{label(t1)}</Text>
      </View>
    </View>
  );
}

// where time t falls among the chart's points, as a fractional index
function position(points: Point[], t: number) {
  let lo = 0, hi = points.length - 1;
  if (t <= points[0].t) return 0;
  if (t >= points[hi].t) return hi;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid].t <= t) lo = mid; else hi = mid; }
  return lo + (t - points[lo].t) / (points[hi].t - points[lo].t);
}

function Rules({ data }: { data: ReportData }) {
  const p = data.prop!;
  const bar = (used: number, limit: number, color: string) => (
    <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, marginTop: 4 }}>
      <View style={{ height: 4, width: `${Math.min(100, (used / limit) * 100)}%`, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
  return (
    <View wrap={false}>
      <Text style={st.h2}>Account rules check</Text>
      <View style={{ border: `0.75pt solid ${C.border}`, borderRadius: 4, padding: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={st.label}>{money(p.size, data.currency)} account · traded {p.tradingDays} of {p.days} days · floating losses included</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", color: p.passed ? C.up : C.down }}>{p.passed ? "PASSED" : "BREACHED"}</Text>
        </View>
        <View style={{ flexDirection: "row", marginTop: 8, gap: 14 }}>
          {p.daily && (
            <View style={{ flex: 1 }}>
              <Text>Daily loss: worst {pct(p.daily.worstPct)} of {p.daily.limitPct}%</Text>
              {bar(p.daily.worstPct, p.daily.limitPct, p.daily.breaches.length ? C.down : "#f59e0b")}
              <Text style={st.note}>{p.daily.breaches.length ? `Breached on ${p.daily.breaches.length} day(s), first ${p.daily.breaches[0]}` : `Worst day ${p.daily.worstDay ?? "–"}`}</Text>
            </View>
          )}
          {p.maxLoss && (
            <View style={{ flex: 1 }}>
              <Text>Max loss ({["static", "trailing", "trailing to start"][p.maxLoss.type] ?? "static"}): worst {pct(p.maxLoss.worstPct)} of {p.maxLoss.limitPct}%</Text>
              {bar(p.maxLoss.worstPct, p.maxLoss.limitPct, p.maxLoss.breachDay ? C.down : C.up)}
              <Text style={st.note}>{p.maxLoss.breachDay ? `Breached on ${p.maxLoss.breachDay}` : `Closest on ${p.maxLoss.worstDay ?? "–"}`}</Text>
            </View>
          )}
          {p.target && (
            <View style={{ flex: 1 }}>
              <Text>Profit target: {p.target.pct}%</Text>
              <Text style={st.note}>{p.target.hitDay ? `Reached on ${p.target.hitDay}` : "Not reached in this test"}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function Monthly({ data }: { data: ReportData }) {
  const cell = (v: number | null, bold = false) => (
    <Text style={{ width: `${100 / 14}%`, textAlign: "right", color: v === null ? C.faint : v >= 0 ? C.up : C.down, fontFamily: bold ? "Helvetica-Bold" : "Helvetica" }}>
      {v === null ? "–" : v.toFixed(1)}
    </Text>
  );
  return (
    <View wrap={false}>
      <Text style={st.h2}>Monthly returns (%)</Text>
      <View style={[st.row, { color: C.muted }]}>
        <Text style={{ width: `${100 / 14}%` }}>Year</Text>
        {Array.from({ length: 12 }, (_, i) => <Text key={i} style={{ width: `${100 / 14}%`, textAlign: "right" }}>{monthName(i)}</Text>)}
        <Text style={{ width: `${100 / 14}%`, textAlign: "right" }}>Year</Text>
      </View>
      {data.monthly.map((r) => (
        <View key={r.year} style={st.row}>
          <Text style={{ width: `${100 / 14}%` }}>{r.year}</Text>
          {r.months.map((v, i) => <Fragment key={i}>{cell(v)}</Fragment>)}
          {cell(r.total, true)}
        </View>
      ))}
      <Text style={st.note}>By the month a trade closed, from the balance before the month's first trade to after its last.</Text>
    </View>
  );
}

const TRADE_COLS: [string, number, "left" | "right"][] = [
  ["#", 24, "left"], ["Side", 30, "left"], ["Lots", 34, "right"], ["Entry time", 84, "left"], ["Entry", 60, "right"],
  ["Exit time", 84, "left"], ["Exit", 60, "right"], ["Profit", 66, "right"], ["Balance", 73, "right"],
];
const cellPad = { paddingHorizontal: 3 };

// The trade list as whole pages of column blocks: one text per column per
// page lays out quickly even for thousands of trades (a box per cell doesn't).
const ROW = 12; // pt per row
const PER_PAGE = 54;

function TradePage({ data, from, first }: { data: ReportData; from: number; first: boolean }) {
  const fmtPrice = (n: number) => String(Number(n.toFixed(5)));
  const rows = data.trades.slice(from, from + PER_PAGE);
  const cols = [
    rows.map((_, i) => String(from + i + 1)), rows.map((t) => t.side), rows.map((t) => String(t.volume)),
    rows.map((t) => t.entryTime.slice(0, 16)), rows.map((t) => fmtPrice(t.entryPrice)),
    rows.map((t) => t.exitTime.slice(0, 16)), rows.map((t) => fmtPrice(t.exitPrice)),
    null, rows.map((t) => money(t.balance)),
  ];
  return (
    <Page size="A4" style={st.page}>
      <Brand data={data} />
      <Text style={[st.h2, { marginTop: 0 }]}>{first ? "Trades" : `Trades (continued from ${from + 1})`}</Text>
      <View style={[st.row, { color: C.muted, fontSize: 7.5 }]}>
        {TRADE_COLS.map(([h, w, align]) => <Text key={h} style={{ ...cellPad, width: w, textAlign: align }}>{h}</Text>)}
      </View>
      <View style={{ position: "relative", fontSize: 7.5 }}>
        {rows.map((_, i) => i % 2 === 1 && (
          <View key={i} style={{ position: "absolute", left: 0, right: 0, top: i * ROW, height: ROW, backgroundColor: C.soft }} />
        ))}
        <View style={{ flexDirection: "row", paddingTop: 2 }}>
          {TRADE_COLS.map(([h, w, align], j) => (
            <Text key={h} style={{ ...cellPad, width: w, textAlign: align, lineHeight: `${ROW}pt` }}>
              {cols[j]?.join("\n") ?? rows.map((t, i) => (
                <Text key={i} style={{ color: t.profit >= 0 ? C.up : C.down }}>{money(t.profit)}{i < rows.length - 1 ? "\n" : ""}</Text>
              ))}
            </Text>
          ))}
        </View>
      </View>
      <Footer data={data} />
    </Page>
  );
}

function About() {
  return (
    <View wrap={false} style={{ marginTop: 18, padding: 10, backgroundColor: C.soft, borderRadius: 4 }}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>About this report</Text>
      <Text style={[st.note, { lineHeight: 1.4 }]}>
        A backtest shows how the strategy's rules would have traded past prices in MetaTrader 5's Strategy Tester, with the
        broker's recorded spreads and the tick model above. It does not include slippage, changing spreads or execution
        differences of live trading, and past results do not guarantee future results.
      </Text>
    </View>
  );
}

export function ReportDocument({ data }: { data: ReportData }) {
  const cur = data.currency;
  return (
    <Document title={`${data.strategy} backtest report`} author="Backtest Studio" creator="Backtest Studio" producer="Backtest Studio">
      <Page size="A4" style={st.page}>
        <Brand data={data} />
        <Text style={st.title}>{data.strategy}</Text>
        <Text style={st.subtitle}>{data.subtitle}</Text>

        <View style={[st.grid, { marginTop: 14, borderTop: `0.75pt solid ${C.border}`, borderBottom: `0.75pt solid ${C.border}`, paddingVertical: 6 }]}>
          {data.meta.map(([l, v]) => (
            <View key={l} style={st.meta}><Text style={st.label}>{l}</Text><Text style={st.metaValue}>{v}</Text></View>
          ))}
        </View>

        <View style={[st.grid, { marginTop: 12, marginHorizontal: -3 }]}>
          {data.kpis.map((k) => (
            <View key={k.label} style={st.card}>
              <View style={st.cardIn}>
                <Text style={st.label}>{k.label}</Text>
                <Text style={[st.kpi, { color: tone(k.tone) }]}>{k.value}</Text>
                <Text style={st.note}>{k.note}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={st.h2}>Balance</Text>
        <Chart points={data.balance} height={130} color={C.line} format={(v) => money(v)} area={false} />
        <Text style={[st.h2, { marginTop: 10 }]}>Drawdown</Text>
        <Chart points={data.drawdown} height={55} color={C.down} area yMax={0} format={(v) => pct(v, 1)} />
        <Text style={st.note}>
          {data.drawdownFromEquity ? "Per day: the lowest equity (open trades included) below the highest value so far." : "Per trade: the balance below its highest value so far."}
        </Text>

        {data.prop && <Rules data={data} />}
        <Footer data={data} />
      </Page>

      <Page size="A4" style={st.page}>
        <Brand data={data} />
        <Text style={[st.h2, { marginTop: 0 }]}>Performance details</Text>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1 }}>
            {data.details.slice(0, 2).map((d) => (
              <View key={d.title} style={{ marginBottom: 10 }}><Text style={[st.label, { marginBottom: 2 }]}>{d.title.toUpperCase()}</Text><Table rows={d.rows} /></View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {data.details.slice(2).map((d) => (
              <View key={d.title} style={{ marginBottom: 10 }}><Text style={[st.label, { marginBottom: 2 }]}>{d.title.toUpperCase()}</Text><Table rows={d.rows} /></View>
            ))}
          </View>
        </View>
        <Text style={st.note}>Amounts in {cur}. Figures from MetaTrader 5's Strategy Tester report.</Text>

        {data.monthly.length > 0 && <Monthly data={data} />}

        <View wrap={false}>
          <Text style={st.h2}>Price and trades</Text>
          <Chart points={data.price.map((p, i) => ({ t: i, v: p.v }))} height={150} color={C.price}
            format={(v) => String(Number(v.toPrecision(6)))} label={(i) => day(data.price[Math.round(i)].t)}>
            {(x, y) => data.marks?.map((m, i) => {
              const cx = x(position(data.price, m.t)), cy = y(m.price);
              if (m.kind === "exit") return <Circle key={i} cx={cx} cy={cy} r={1.4} fill={C.muted} />;
              const d = m.kind === "buy" ? 1 : -1;
              return <Polygon key={i} points={`${cx},${cy - 3.2 * d} ${cx - 2.6},${cy + 1.8 * d} ${cx + 2.6},${cy + 1.8 * d}`} fill={m.kind === "buy" ? C.up : C.down} />;
            })}
          </Chart>
          <Text style={st.note}>
            {data.marks ? "Green: buy entries. Red: sell entries. Grey: exits." : `${data.trades.length} trades: too many to mark on the chart.`} Times are the broker's server time.
          </Text>
        </View>
        <Footer data={data} />
      </Page>

      <Page size="A4" style={st.page}>
        <Brand data={data} />
        {data.inputs.length > 0 && <Text style={[st.h2, { marginTop: 0 }]}>Settings used</Text>}
        {data.inputs.map((g) => (
          <View key={g.title} style={{ marginBottom: 12 }}>
            <Text style={[st.label, { marginBottom: 2 }]}>{g.title.toUpperCase()}</Text>
            <Table rows={g.rows.map((r) => [r.label, r.value])} />
          </View>
        ))}
        <About />
        <Footer data={data} />
      </Page>

      {Array.from({ length: Math.ceil(data.trades.length / PER_PAGE) }, (_, k) => (
        <TradePage key={k} data={data} from={k * PER_PAGE} first={k === 0} />
      ))}

      {data.source && (
        <Page size="A4" style={st.page}>
          <Brand data={data} />
          <Text style={[st.h2, { marginTop: 0 }]}>Strategy code</Text>
          <Text style={{ fontFamily: "Courier", fontSize: 6.8, lineHeight: 1.3 }}>
            {data.source.replace(/\t/g, "   ").replace(/^ +/gm, (sp) => "\u00a0".repeat(sp.length))}
          </Text>
          <Footer data={data} />
        </Page>
      )}
    </Document>
  );
}
