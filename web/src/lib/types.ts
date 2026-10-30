// Mirrors server/report.ts, server/mt5.ts and server/claude.ts.

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

export type Bar = { time: number; open: number; high: number; low: number; close: number };

export type RunMeta = {
  id: string; strategy: string; status: "running" | "done" | "failed"; stage?: "tester" | "report" | "bars";
  started: string; finished?: string; error?: string; tester: Record<string, string>;
};

export type Run = {
  meta: RunMeta;
  avgSpread: number | null;
  prop: PropCheck | null;
  summary: Record<string, string>;
  deals: Deal[];
  trades: Trade[];
  bars: Bar[];
};

export type Mt5State = "ready" | "testing" | "symbols" | "live" | "gui-open";

export type ChatEvent =
  | { kind: "user"; text: string; model?: string; effort?: string }
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; input: Record<string, unknown> }
  | { kind: "tool_result"; id: string; output: string; error: boolean }
  | { kind: "done"; cost?: number; error?: string };

export type Thread = { id: string; title: string; created: string };

export type ChatSettings = { model: string; effort: string };

// [Tester] keys the settings bar edits; values exactly as in tester.ini
export type Settings = {
  Symbol: string; Period: string; Model: string; FromDate: string; ToDate: string;
  Deposit: string; Currency: string; Leverage: string;
};

export type SymbolInfo = {
  name: string; description: string; path: string; digits: number;
  spread: number | null; history: [number, number] | null;
};
export type SymbolList = { server: string; refreshed: string | null; symbols: SymbolInfo[] };

// an `input` line of the strategy's .mq5, with its current value
export type StrategyInput = {
  name: string; type: string; default: string; comment: string; value: string;
  group: string; options?: { value: string; label: string }[];
};

export type RuleProfile = { name: string; values: Record<string, string> };

// mirrors server/prop.ts
export type PropCheck = {
  size: number;
  daily: { limitPct: number; worstPct: number; worstDay: string | null; breaches: string[] } | null;
  maxLoss: { limitPct: number; type: number; worstPct: number; worstDay: string | null; breachDay: string | null } | null;
  target: { pct: number; hitDay: string | null } | null;
  tradingDays: number;
  days: number;
  passed: boolean;
};

export type LiveStatus = {
  strategy: string; symbol: string; period: string; inputs: Record<string, string>;
  started: string; login: string; server: string; running: boolean;
};
export type Account = { login: string; server: string; demo: boolean };
