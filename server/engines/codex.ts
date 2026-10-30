// OpenAI Codex CLI: `codex exec --json` in workspace/ with the workspace-write
// sandbox. Codex can't limit which commands run, only where they write.
// Built from the documented event format; not tested here (not installed).
import type { Engine, EngineStatus, SendContext } from "./types";
import { findBinary, version, runJsonLines } from "./cli";

const bin = () => findBinary("codex", ["~/.local/bin", "~/.npm-global/bin"]);

export const codexEngine: Engine = {
  id: "codex",
  label: "Codex CLI",
  kind: "cli",

  async detect(): Promise<EngineStatus> {
    const b = bin();
    return {
      id: this.id, label: this.label, kind: this.kind, available: !!b,
      detail: b ? `${version(b)} · ${b} · runs any command inside the workspace sandbox` : "Not installed",
      setup: "Install Codex CLI (npm i -g @openai/codex) and run `codex login`.",
      models: [{ id: "default", label: "Codex's default model", efforts: ["low", "medium", "high"] }],
      customModels: true,
    };
  },

  async send(ctx: SendContext) {
    const b = bin();
    if (!b) throw new Error("Codex CLI is not installed");
    const args = [b, "exec"];
    if (ctx.session) args.push("resume", ctx.session);
    args.push("--json", "--skip-git-repo-check", "--sandbox", "workspace-write");
    if (ctx.model && ctx.model !== "default") args.push("--model", ctx.model);
    if (ctx.effort) args.push("-c", `model_reasoning_effort="${ctx.effort}"`);
    args.push("--", ctx.message);

    let finished = false;
    const r = await runJsonLines(args, { signal: ctx.signal }, (ev) => {
      const it = ev.item ?? {};
      if (ev.type === "thread.started" && ev.thread_id) ctx.setSession(ev.thread_id);
      if (ev.type === "item.started" && it.type === "command_execution") ctx.emit({ kind: "tool", id: it.id, name: "Bash", input: { command: it.command } });
      if (ev.type === "item.completed") {
        if (it.type === "agent_message" && it.text) ctx.emit({ kind: "text", text: `${it.text}\n\n` });
        if (it.type === "command_execution") ctx.emit({ kind: "tool_result", id: it.id, output: String(it.aggregated_output ?? ""), error: it.exit_code !== 0 });
        if (it.type === "file_change") {
          ctx.emit({ kind: "tool", id: it.id, name: "Edit", input: { file_path: (it.changes ?? []).map((c: any) => c.path).join(", ") } });
          ctx.emit({ kind: "tool_result", id: it.id, output: "applied", error: it.status === "failed" });
        }
      }
      if (ev.type === "turn.completed") { finished = true; ctx.emit({ kind: "done" }); }
      if (ev.type === "turn.failed") { finished = true; ctx.emit({ kind: "done", error: String(ev.error?.message ?? "Codex failed") }); }
    });
    if (!finished) ctx.emit({ kind: "done", error: r.stopped ? "Stopped" : r.stderr.slice(0, 300) || `codex exited with code ${r.code}` });
  },
};
