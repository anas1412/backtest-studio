// Folds the flat chat event stream into display items: user bubbles,
// assistant text, groups of consecutive tool steps, and run cards.
import type { ActivityStatus, AgentActivityItemData } from "@/components/ui/ai-agent-activity";
import type { ChatEvent } from "@/lib/types";

export type Item =
  | { kind: "user"; key: string; text: string; model?: string; effort?: string }
  | { kind: "assistant"; key: string; text: string }
  | { kind: "tools"; key: string; steps: AgentActivityItemData[] }
  | { kind: "run"; key: string; runId: string }
  | { kind: "error"; key: string; text: string };

const file = (p: unknown) => String(p ?? "").split("/workspace/").pop() ?? "";

function describe(name: string, input: Record<string, unknown>): Pick<AgentActivityItemData, "type" | "title" | "description" | "details"> {
  const cmd = String(input.command ?? "");
  const script = cmd.match(/tools\/(compile|backtest)\.sh\s+(\w+)/);
  if (script) {
    return script[1] === "compile"
      ? { type: "code_execution", title: `Compile ${script[2]}`, description: "MetaEditor (Wine)" }
      : { type: "tool_execution", title: `Backtest ${script[2]}`, description: "MT5 Strategy Tester" };
  }
  switch (name) {
    case "Write":
      return { type: "writing", title: `Write ${file(input.file_path)}`,
        details: { codeSnippet: String(input.content ?? ""), language: String(input.file_path).endsWith(".ini") ? "ini" : "mql5" } };
    case "Edit":
      return { type: "writing", title: `Edit ${file(input.file_path)}`,
        details: { codeSnippet: String(input.new_string ?? ""), language: "mql5" } };
    case "Read":
      return { type: "reading", title: `Read ${file(input.file_path)}` };
    case "Glob":
    case "Grep":
      return { type: "searching", title: `${name} ${String(input.pattern ?? "")}` };
    case "Bash":
      return { type: "tool_execution", title: cmd };
    default:
      return { type: "tool_execution", title: name };
  }
}

const failed = (out: string) => /COMPILE FAILED|BACKTEST (FAILED|REFUSED)/.test(out);

export function buildTranscript(events: ChatEvent[], live: boolean): Item[] {
  const items: Item[] = [];
  const steps = new Map<string, AgentActivityItemData>();
  events.forEach((e, i) => {
    const last = items[items.length - 1];
    const key = String(i);
    switch (e.kind) {
      case "user":
        items.push({ kind: "user", key, text: e.text, model: e.model, effort: e.effort });
        break;
      case "text":
        if (last?.kind === "assistant") last.text += e.text;
        else if (e.text.trim()) items.push({ kind: "assistant", key, text: e.text });
        break;
      case "tool": {
        const step: AgentActivityItemData = { id: e.id, status: "running", ...describe(e.name, e.input) };
        steps.set(e.id, step);
        if (last?.kind === "tools") last.steps.push(step);
        else items.push({ kind: "tools", key, steps: [step] });
        break;
      }
      case "tool_result": {
        const step = steps.get(e.id);
        if (!step) break;
        const status: ActivityStatus = e.error || failed(e.output) ? "error" : "success";
        step.status = status;
        step.details = { ...step.details, output: e.output };
        const run = e.output.match(/^RUN (\S+)/m);
        if (run) items.push({ kind: "run", key, runId: run[1] });
        break;
      }
      case "done":
        if (e.error) items.push({ kind: "error", key, text: e.error });
        break;
    }
  });
  // steps that never got a result: still running, or cut off
  if (!live) for (const s of steps.values()) if (s.status === "running") s.status = "cancelled";
  return items;
}

