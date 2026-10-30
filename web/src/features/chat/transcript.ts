// Folds the flat chat event stream into display items: user bubbles,
// assistant text, groups of consecutive tool steps, and run cards.
import type { ActivityStatus, AgentActivityItemData } from "@/components/ui/ai-agent-activity";
import type { ChatEvent } from "@/lib/types";

export type Item =
  | { kind: "user"; key: string; text: string; engine?: string; model?: string; effort?: string }
  | { kind: "assistant"; key: string; text: string }
  | { kind: "tools"; key: string; steps: AgentActivityItemData[] }
  | { kind: "run"; key: string; runId: string }
  | { kind: "confirm"; key: string; id: string; question: string; answer?: boolean }
  | { kind: "error"; key: string; text: string };

const file = (p: unknown) => String(p ?? "").split("/workspace/").pop() ?? "";

// Engines name the same actions differently (Claude "Write", opencode
// "write", Gemini "write_file", the API agent "write_file"): map them to one
// display. The studio's own actions read the same from every engine.
function describe(name: string, input: Record<string, unknown>): Pick<AgentActivityItemData, "type" | "title" | "description" | "details"> {
  const n = name.toLowerCase();
  const path = file(input.file_path ?? input.filePath ?? input.path ?? input.absolute_path);
  const cmd = String(input.command ?? "");
  const script = cmd.match(/tools\/(compile|backtest|live)\.sh\s+(\w+)/);
  const studio = script ? { action: script[1], arg: script[2] }
    : ["compile", "backtest"].includes(n) ? { action: n, arg: String(input.strategy ?? "") }
    : n.startsWith("live_") ? { action: "live", arg: n.slice(5) } : null;
  if (studio?.action === "compile") return { type: "code_execution", title: `Compile ${studio.arg}`, description: "MetaEditor" };
  if (studio?.action === "backtest") return { type: "tool_execution", title: `Backtest ${studio.arg}`, description: "MT5 Strategy Tester" };
  if (studio?.action === "live") return { type: "tool_execution", title: `Live trading: ${studio.arg}`, description: "MT5" };

  if (/^(write|write_file|create)$/.test(n)) {
    return { type: "writing", title: `Write ${path}`,
      details: { codeSnippet: String(input.content ?? ""), language: path.endsWith(".ini") ? "ini" : "mql5" } };
  }
  if (/^(edit|edit_file|replace|multiedit|patch)$/.test(n)) {
    return { type: "writing", title: `Edit ${path}`,
      details: { codeSnippet: String(input.new_string ?? input.newString ?? input.new_text ?? ""), language: "mql5" } };
  }
  if (/^(read|read_file|view)$/.test(n)) return { type: "reading", title: `Read ${path}` };
  if (/^(glob|grep|list|list_files|ls|search_file_content)$/.test(n)) {
    return { type: "searching", title: `${name} ${String(input.pattern ?? input.dir ?? input.path ?? "")}`.trim() };
  }
  if (cmd) return { type: "tool_execution", title: cmd };
  return { type: "tool_execution", title: name };
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
        items.push({ kind: "user", key, text: e.text, engine: e.engine, model: e.model, effort: e.effort });
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
      case "confirm": {
        // the answer arrives as a second event with the same id
        const asked = items.find((x) => x.kind === "confirm" && x.id === e.id);
        if (asked && asked.kind === "confirm") asked.answer = e.answer;
        else items.push({ kind: "confirm", key, id: e.id, question: e.question, answer: e.answer });
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

