// Gemini CLI: `gemini -p … -o stream-json` in workspace/, auto-approving file
// edits and only the studio's scripts in the shell. Built from the CLI's
// documented headless format; not verified end to end here (the free
// individual login was discontinued; it works with GEMINI_API_KEY).
import type { Engine, EngineStatus, SendContext } from "./types";
import { findBinary, version, runJsonLines } from "./cli";

const bin = () => findBinary("gemini", ["~/.local/bin", "~/.npm-global/bin"]);
const SCRIPTS = ["compile", "backtest", "live"].flatMap((s) => [
  `run_shell_command(tools/${s}.sh)`, `run_shell_command(./tools/${s}.sh)`, `run_shell_command(tools\\${s}.cmd)`,
]);

export const geminiEngine: Engine = {
  id: "gemini",
  label: "Gemini CLI",
  kind: "cli",

  async detect(): Promise<EngineStatus> {
    const b = bin();
    return {
      id: this.id, label: this.label, kind: this.kind, available: !!b,
      detail: b ? `${version(b)} · ${b}` : "Not installed",
      setup: "Install Gemini CLI and sign in, or set GEMINI_API_KEY before starting the studio.",
      models: [
        { id: "default", label: "Gemini CLI's default model" },
        { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
        { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      ],
      customModels: true,
    };
  },

  async send(ctx: SendContext) {
    const b = bin();
    if (!b) throw new Error("Gemini CLI is not installed");
    const args = [b, "-o", "stream-json", "--approval-mode", "auto_edit", "--skip-trust", "--allowed-tools", ...SCRIPTS];
    if (ctx.model && ctx.model !== "default") args.push("-m", ctx.model);
    if (ctx.session) args.push("--resume", ctx.session);
    else {
      const id = crypto.randomUUID();
      args.push("--session-id", id);
      ctx.setSession(id);
    }
    args.push("-p", ctx.message);

    let finished = false;
    const r = await runJsonLines(args, { signal: ctx.signal }, (ev) => {
      switch (ev.type) {
        case "message":
          if (ev.role === "assistant" && ev.content) ctx.emit({ kind: "text", text: ev.content });
          break;
        case "tool_use":
          ctx.emit({ kind: "tool", id: ev.tool_id, name: ev.tool_name, input: ev.parameters ?? {} });
          break;
        case "tool_result":
          ctx.emit({ kind: "tool_result", id: ev.tool_id, output: String(ev.output ?? ev.error?.message ?? ""), error: ev.status === "error" });
          break;
        case "result":
          finished = true;
          ctx.emit({ kind: "done", error: ev.status === "error" ? String(ev.error?.message ?? "Gemini CLI reported an error") : undefined });
          break;
      }
    });
    if (!finished) ctx.emit({ kind: "done", error: r.stopped ? "Stopped" : firstError(r.stderr) || `gemini exited with code ${r.code}` });
  },
};

// the CLI prints stack traces; the first error line says what went wrong
const firstError = (s: string) => s.split("\n").find((l) => /error/i.test(l))?.trim() ?? s.slice(0, 300);
