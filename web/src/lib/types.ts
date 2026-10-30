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
  | { kind: "user"; text: string; engine?: string; model?: string; effort?: string }
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; input: Record<string, unknown> }
  | { kind: "tool_result"; id: string; output: string; error: boolean }
  | { kind: "confirm"; id: string; question: string; answer?: boolean }
  | { kind: "done"; cost?: number; error?: string };

export type Thread = { id: string; title: string; created: string };

export type ChatSettings = { engine: string; model: string; effort: string };

// mirrors server/engines/types.ts
export type ModelInfo = { id: string; label: string; efforts?: string[] };
export type EngineStatus = {
  id: string; label: string; kind: "cli" | "api"; available: boolean; detail: string;
  setup?: string; models: ModelInfo[]; customModels: boolean;
};
// mirrors server/keys.ts publicView()
export type KeyProvider = {
  id: string; label: string; env?: string; needsKey: boolean; needsURL: boolean; defaultURL?: string; hint: string;
  configured: boolean; key: string | null; fromEnv: boolean; baseURL: string | null;
};

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
// What a PDF report needs beyond Run (GET /api/runs/:id/report).
export type DailyRow = {
  day: string; startBalance: number; startEquity: number; minEquity: number; maxEquity: number;
  endBalance: number; endEquity: number; trades: number;
};
export type RunReport = { inputs: StrategyInput[]; daily: DailyRow[]; source: string };

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

export type Mt5Install = { dir: string; prefix: string | null; name: string; portable: boolean };
export type Mt5Account = { login: string; server: string; lastSeen: string | null; current: boolean; failed: string | null };
export type Mt5Info = {
  installs: Mt5Install[]; dir: string; linked: boolean;
  account: { login: string; server: string } | null; lastLogin: { login: string; server: string };
  accounts: Mt5Account[];
};
