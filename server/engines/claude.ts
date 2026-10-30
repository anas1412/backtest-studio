// Claude Code CLI: `claude -p` in workspace/, resumed by its session id,
// limited to file edits there and the studio's three scripts.
import type { Engine, EngineStatus, SendContext, ChatEvent } from "./types";
import { findBinary, version, runJsonLines } from "./cli";

const ALLOWED = [
  "Read", "Write", "Edit", "Glob", "Grep",
  "Bash(tools/compile.sh:*)", "Bash(./tools/compile.sh:*)",
  "Bash(tools/backtest.sh:*)", "Bash(./tools/backtest.sh:*)",
  "Bash(tools/live.sh:*)", "Bash(./tools/live.sh:*)",
];
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const MODELS = [
  { id: "opus", label: "Opus 5.5", efforts: EFFORTS },
  { id: "sonnet", label: "Sonnet 5.5", efforts: EFFORTS },
  { id: "haiku", label: "Haiku 5.5", efforts: EFFORTS },
  { id: "fable", label: "Fable 5.1", efforts: EFFORTS },
];

const bin = () => findBinary("claude", ["~/.local/bin", "~/.claude/local"]);

export const claudeEngine: Engine = {
  id: "claude",
  label: "Claude Code",
  kind: "cli",

  async detect(): Promise<EngineStatus> {
    const b = bin();
    return {
      id: this.id, label: this.label, kind: this.kind, available: !!b,
      detail: b ? `${version(b)} · ${b}` : "Not installed",
      setup: "Install Claude Code (claude.com/claude-code) and run `claude` once to log in.",
      models: MODELS, customModels: true,
    };
  },

  async send(ctx: SendContext) {
    const b = bin();
    if (!b) throw new Error("Claude Code is not installed");
    // prompt goes in on stdin, so a message starting with "-" is never read as a flag
    const args = [b, "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
      "--model", ctx.model, ...(ctx.effort ? ["--effort", ctx.effort] : []),
      "--permission-mode", "acceptEdits", "--allowedTools", ...ALLOWED];
    if (ctx.session) args.push("--resume", ctx.session);

    let finished = false;
    const r = await runJsonLines(args, { stdin: ctx.message, signal: ctx.signal }, (ev) => {
      if (ev.session_id && ev.session_id !== ctx.session) ctx.setSession(ev.session_id);
      if (handle(ev, ctx.emit)) finished = true;
    });
    if (!finished) ctx.emit({ kind: "done", error: r.stopped ? "Stopped" : r.stderr || `claude exited with code ${r.code}` });
  },
};

// returns true on the final "result" event
function handle(ev: any, emit: (e: ChatEvent) => void): boolean {
  switch (ev.type) {
    case "stream_event": {
      const d = ev.event?.delta;
      if (ev.event?.type === "content_block_delta" && d?.type === "text_delta") emit({ kind: "text", text: d.text });
      return false;
    }
    case "assistant":
      for (const c of ev.message?.content ?? []) {
        if (c.type === "tool_use") emit({ kind: "tool", id: c.id, name: c.name, input: c.input });
      }
      return false;
    case "user":
      for (const c of ev.message?.content ?? []) {
        if (c.type !== "tool_result") continue;
        const out = typeof c.content === "string" ? c.content
          : (c.content ?? []).map((x: any) => x.text ?? "").join("\n");
        emit({ kind: "tool_result", id: c.tool_use_id, output: out, error: !!c.is_error });
      }
      return false;
    case "result":
      emit({ kind: "done", cost: ev.total_cost_usd, error: ev.is_error ? String(ev.result ?? "error") : undefined });
      return true;
  }
  return false;
}
