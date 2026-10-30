// opencode: `opencode run --format json` in workspace/. Its permissions come
// from workspace/opencode.json: file edits, and only the studio's scripts in
// the shell; --auto approves what isn't denied there.
import type { Engine, EngineStatus, SendContext } from "./types";
import { findBinary, version, runJsonLines } from "./cli";
import { WORKSPACE } from "../paths";

const bin = () => findBinary("opencode", ["~/.opencode/bin"]);
let models: { id: string; label: string }[] | null = null;

export const opencodeEngine: Engine = {
  id: "opencode",
  label: "opencode",
  kind: "cli",

  async detect(): Promise<EngineStatus> {
    const b = bin();
    if (b && !models) {
      // every model of every provider opencode is set up for
      const out = Bun.spawnSync([b, "models"], {
        stdout: "pipe", stderr: "ignore", cwd: WORKSPACE, env: { ...process.env, PWD: WORKSPACE },
      }).stdout.toString();
      models = out.split("\n").map((l) => l.trim()).filter((l) => /^[\w.-]+\/\S+$/.test(l)).map((id) => ({ id, label: id }));
    }
    return {
      id: this.id, label: this.label, kind: this.kind, available: !!b,
      detail: b ? `${version(b)} · ${b} · ${models?.length ?? 0} models` : "Not installed",
      setup: "Install opencode (opencode.ai) and connect a provider with `opencode auth login`.",
      models: [{ id: "default", label: "opencode's default model" }, ...(models ?? [])], customModels: true,
    };
  },

  async send(ctx: SendContext) {
    const b = bin();
    if (!b) throw new Error("opencode is not installed");
    const args = [b, "run", "--format", "json", "--auto"];
    if (ctx.model && ctx.model !== "default") args.push("--model", ctx.model);
    if (ctx.session) args.push("--session", ctx.session);
    args.push("--", ctx.message);

    let cost = 0;
    const r = await runJsonLines(args, { signal: ctx.signal }, (ev) => {
      if (ev.sessionID && ev.sessionID !== ctx.session) ctx.setSession(ev.sessionID);
      const p = ev.part ?? {};
      if (ev.type === "text" && p.text) ctx.emit({ kind: "text", text: `${p.text}\n\n` });
      if (ev.type === "tool_use") {
        ctx.emit({ kind: "tool", id: p.id, name: p.tool, input: p.state?.input ?? {} });
        if (p.state?.status === "completed" || p.state?.status === "error") {
          ctx.emit({ kind: "tool_result", id: p.id, output: String(p.state.output ?? p.state.error ?? ""), error: p.state.status === "error" });
        }
      }
      if (ev.type === "step_finish" && typeof p.cost === "number") cost += p.cost;
    });
    ctx.emit({ kind: "done", cost, error: r.stopped ? "Stopped" : r.code ? r.stderr || `opencode exited with code ${r.code}` : undefined });
  },
};
