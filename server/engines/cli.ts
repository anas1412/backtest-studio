// Shared plumbing for agent CLIs: find the binary, run it in workspace/,
// read its JSON-lines output, stop it on Stop.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { WORKSPACE, IS_WINDOWS } from "../paths";

// PATH first, then the places installers drop binaries without touching PATH.
export function findBinary(name: string, extra: string[] = []): string | null {
  const exe = IS_WINDOWS ? [`${name}.exe`, `${name}.cmd`] : [name];
  const dirs = [...(process.env.PATH ?? "").split(IS_WINDOWS ? ";" : ":"), ...extra.map((d) => d.replace(/^~/, homedir()))];
  for (const d of dirs) for (const e of exe) if (d && existsSync(join(d, e))) return join(d, e);
  return null;
}

export function version(bin: string): string {
  const out = Bun.spawnSync([bin, "--version"], { stdout: "pipe", stderr: "pipe" });
  return (out.stdout.toString() || out.stderr.toString()).trim().split("\n")[0] ?? "";
}

// Runs the CLI, calls onLine for each JSON line, and resolves with the exit
// code and stderr. Aborting kills it.
export async function runJsonLines(cmd: string[], opts: { stdin?: string; signal: AbortSignal; env?: Record<string, string> },
  onLine: (ev: any) => void): Promise<{ code: number | null; stderr: string; stopped: boolean }> {
  const proc = Bun.spawn(cmd, {
    cwd: WORKSPACE, stdout: "pipe", stderr: "pipe",
    stdin: opts.stdin !== undefined ? Buffer.from(opts.stdin) : "ignore",
    // PWD too: some CLIs (opencode) take their project folder from it, not from cwd
    env: { ...process.env, PWD: WORKSPACE, ...opts.env },
  });
  let stopped = false;
  const kill = () => { stopped = true; proc.kill(); };
  opts.signal.addEventListener("abort", kill, { once: true });
  const stderr = new Response(proc.stderr as ReadableStream).text();
  let buf = "";
  const dec = new TextDecoder();
  for await (const chunk of proc.stdout as ReadableStream<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("{")) continue; // banners and warnings
      try { onLine(JSON.parse(line)); } catch { /* partial or non-JSON line */ }
    }
  }
  const code = await proc.exited;
  opts.signal.removeEventListener("abort", kill);
  return { code, stderr: (await stderr).trim(), stopped };
}
