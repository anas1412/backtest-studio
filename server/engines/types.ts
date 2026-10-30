// What every AI engine (an agent CLI or the built-in API agent) provides.
// Engines turn one user message into the chat events the UI renders.

export type ChatEvent =
  | { kind: "user"; text: string; engine?: string; model?: string; effort?: string }
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; input: unknown }
  | { kind: "tool_result"; id: string; output: string; error: boolean }
  | { kind: "confirm"; id: string; question: string; answer?: boolean }
  | { kind: "done"; cost?: number; error?: string };

export type ModelInfo = { id: string; label: string; efforts?: string[] };

export type EngineStatus = {
  id: string;
  label: string;
  kind: "cli" | "api";
  available: boolean;
  detail: string;      // version and path, or why it isn't available
  setup?: string;      // how to install / log in / add a key
  models: ModelInfo[];
  customModels: boolean; // the picker may also take a typed model id
};

export type SendContext = {
  message: string;
  model: string;
  effort?: string;
  session?: string;                     // the engine's own session id from the last turn (CLIs)
  history?: unknown[];                  // the API agent's message history
  emit: (e: ChatEvent) => void;
  setSession: (id: string) => void;
  setHistory: (h: unknown[]) => void;
  confirm: (question: string) => Promise<boolean>; // asks the user in the chat
  signal: AbortSignal;                  // Stop
};

export interface Engine {
  id: string;
  label: string;
  kind: "cli" | "api";
  detect(): Promise<EngineStatus>;
  send(ctx: SendContext): Promise<void>;
}
