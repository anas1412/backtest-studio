// The built-in agent for API keys: any provider through the AI SDK, with the
// same tools for every model. Tools only touch workspace/ (writes only under
// strategies/) and the studio's actions; starting or stopping live trading
// asks the user in the chat first.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, resolve, relative, sep, dirname } from "node:path";
import { streamText, tool, stepCountIs, type ModelMessage, type LanguageModel } from "ai";
import { z } from "zod";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogle } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Engine, EngineStatus, SendContext, ModelInfo } from "./types";
import { WORKSPACE, STRATEGIES } from "../paths";
import { PROVIDERS, credentials, listModels, type ProviderId } from "../keys";
import { compileStrategy, backtestStrategy, liveStatusText, liveStart, liveStop } from "../actions";

const EFFORTS = ["low", "medium", "high"];

function languageModel(p: ProviderId, model: string): LanguageModel {
  const c = credentials(p)!;
  switch (p) {
    case "anthropic": return createAnthropic({ apiKey: c.key })(model);
    case "openai": return createOpenAI({ apiKey: c.key })(model);
    case "google": return createGoogle({ apiKey: c.key })(model);
    case "deepseek": return createDeepSeek({ apiKey: c.key })(model);
    case "openrouter": return createOpenRouter({ apiKey: c.key })(model);
    case "compatible": return createOpenAICompatible({ name: "compatible", baseURL: c.baseURL!, apiKey: c.key })(model);
    case "ollama": return createOpenAICompatible({ name: "ollama", baseURL: `${c.baseURL}/v1` })(model);
  }
}

// Which models take a reasoning-effort setting, and how each provider spells it.
function effortsFor(p: ProviderId, model: string): string[] | undefined {
  if (p === "anthropic") return EFFORTS;
  if (p === "openai" && /^(o\d|gpt-5)/.test(model)) return EFFORTS;
  if (p === "google" && /gemini-(2\.5|[3-9])/.test(model)) return EFFORTS;
  return undefined;
}
function providerOptions(p: ProviderId, model: string, effort?: string) {
  if (!effort || !effortsFor(p, model)) return undefined;
  if (p === "anthropic") return { anthropic: { effort } };
  if (p === "openai") return { openai: { reasoningEffort: effort } };
  if (p === "google") return { google: { thinkingConfig: { thinkingLevel: effort } } };
  return undefined;
}

// workspace-relative path -> absolute, or an error for anything outside it
function inWorkspace(path: string, write = false): string {
  const abs = resolve(WORKSPACE, path);
  const rel = relative(WORKSPACE, abs);
  if (rel.startsWith("..") || rel.split(sep).includes(".studio")) throw new Error(`${path} is outside the workspace`);
  if (write && relative(STRATEGIES, abs).startsWith("..")) throw new Error("Only files under strategies/ can be written");
  return abs;
}

function listFiles(dir: string, depth = 0): string[] {
  if (depth > 3 || !existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => !f.startsWith(".") && !/\.(ex5|log)$/.test(f)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listFiles(p, depth + 1) : [relative(WORKSPACE, p)];
  });
}

function tools(ctx: SendContext) {
  return {
    list_files: tool({
      description: "List files in the workspace (strategies/, tools/include/).",
      inputSchema: z.object({ dir: z.string().optional().describe("Folder relative to the workspace, default: everything") }),
      execute: async ({ dir }) => listFiles(inWorkspace(dir ?? ".")).join("\n") || "(empty)",
    }),
    read_file: tool({
      description: "Read a text file in the workspace, e.g. strategies/<name>/<name>.mq5 or tools/include/Risk.mqh.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => readFileSync(inWorkspace(path), "utf8"),
    }),
    write_file: tool({
      description: "Create or replace a file under strategies/ (the EA and its tester.ini).",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }) => {
        const abs = inWorkspace(path, true);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, content);
        return `Wrote ${path}`;
      },
    }),
    edit_file: tool({
      description: "Replace one exact, unique piece of text in a file under strategies/.",
      inputSchema: z.object({ path: z.string(), old_text: z.string(), new_text: z.string() }),
      execute: async ({ path, old_text, new_text }) => {
        const abs = inWorkspace(path, true);
        const text = readFileSync(abs, "utf8");
        const n = text.split(old_text).length - 1;
        if (n !== 1) throw new Error(n ? `old_text appears ${n} times; include more context` : "old_text not found");
        writeFileSync(abs, text.replace(old_text, new_text));
        return `Edited ${path}`;
      },
    }),
    compile: tool({
      description: "Compile strategies/<name>/<name>.mq5 with MetaEditor and return errors/warnings.",
      inputSchema: z.object({ strategy: z.string() }),
      execute: async ({ strategy }) => (await compileStrategy(strategy)).text,
    }),
    backtest: tool({
      description: "Compile, then run strategies/<name> in the MT5 Strategy Tester with its tester.ini. Returns key stats and the run id.",
      inputSchema: z.object({ strategy: z.string() }),
      execute: async ({ strategy }) => (await backtestStrategy(strategy)).text,
    }),
    live_status: tool({
      description: "Which strategy is trading live in MT5, if any.",
      inputSchema: z.object({}),
      execute: async () => liveStatusText().text,
    }),
    live_start: tool({
      description: "Start trading a strategy live in MT5. Only when the user explicitly asked in their latest message; they are asked to confirm.",
      inputSchema: z.object({ strategy: z.string() }),
      execute: async ({ strategy }) => {
        if (!(await ctx.confirm(`Start trading ${strategy} live in MT5?`))) return "The user declined. Live trading was not started.";
        return (await liveStart(strategy)).text;
      },
    }),
    live_stop: tool({
      description: "Stop live trading (closes MT5; open positions stay open). Only when the user asked; they are asked to confirm.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!(await ctx.confirm("Stop live trading?"))) return "The user declined. Live trading keeps running.";
        return (await liveStop()).text;
      },
    }),
  };
}

function instructions(): string {
  const shared = readFileSync(join(WORKSPACE, "AGENTS.md"), "utf8");
  return `${shared}\n\n## In this session\nYou have tools instead of a shell: the commands above map to the tools ` +
    "compile, backtest, live_start, live_stop and live_status; edit files with read_file, write_file and edit_file. " +
    "Paths are relative to the workspace.";
}

const toText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

export function apiEngine(p: ProviderId): Engine {
  const info = PROVIDERS.find((x) => x.id === p)!;
  let modelCache: ModelInfo[] | null = null;
  return {
    id: `api:${p}`,
    label: info.label,
    kind: "api",

    async detect(): Promise<EngineStatus> {
      const base = { id: this.id, label: this.label, kind: this.kind, setup: info.hint, customModels: true };
      if (!credentials(p)) return { ...base, available: false, detail: info.needsKey ? "No API key" : "Not set up", models: [] };
      try {
        modelCache = (await listModels(p)).map((m) => ({ ...m, efforts: effortsFor(p, m.id) }));
        return { ...base, available: true, detail: `${modelCache.length} models`, models: modelCache };
      } catch (e) {
        return { ...base, available: false, detail: `Key check failed: ${(e as Error).message}`, models: [] };
      }
    },

    async send(ctx: SendContext) {
      if (!credentials(p)) throw new Error(`${info.label} isn't set up`);
      await runAgent(languageModel(p, ctx.model), ctx, providerOptions(p, ctx.model, ctx.effort));
    },
  };
}

// The agent loop itself, for any model: streams text and tool steps into the
// chat and keeps the conversation for the next message.
export async function runAgent(model: LanguageModel, ctx: SendContext, options?: Record<string, unknown>) {
  const messages: ModelMessage[] = [...(ctx.history as ModelMessage[] ?? []), { role: "user", content: ctx.message }];
  const result = streamText({
    model,
    system: instructions(),
    messages,
    tools: tools(ctx),
    stopWhen: stepCountIs(30),
    abortSignal: ctx.signal,
    providerOptions: options as never,
  });
  let error: string | undefined;
  try {
    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": ctx.emit({ kind: "text", text: part.text }); break;
        case "tool-call": ctx.emit({ kind: "tool", id: part.toolCallId, name: part.toolName, input: part.input }); break;
        case "tool-result": ctx.emit({ kind: "tool_result", id: part.toolCallId, output: toText(part.output), error: false }); break;
        case "tool-error": ctx.emit({ kind: "tool_result", id: part.toolCallId, output: String((part.error as Error)?.message ?? part.error), error: true }); break;
        case "error": error = String((part.error as Error)?.message ?? part.error); break;
      }
    }
    // the next message continues from everything said and done in this one
    ctx.setHistory([...messages, ...(await result.responseMessages)]);
  } catch (e) {
    error = ctx.signal.aborted ? "Stopped" : (e as Error).message;
  }
  ctx.emit({ kind: "done", error });
}
