import { join, normalize } from "node:path";
import { WEB } from "./paths";
import { subscribe } from "./events";
import * as claude from "./claude";
import { listRuns, getRun, getRunFiles, listStrategies, mt5State, rerun, startWatching } from "./runs";

const PORT = Number(process.env.PORT ?? 4747);
const DIST = join(WEB, "dist");
startWatching();

const json = (d: unknown, status = 200) => Response.json(d, { status });

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 0, // SSE stays open
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;
    const post = req.method === "POST";
    let m: RegExpMatchArray | null;

    if (p === "/api/events") {
      return subscribe([
        ["threads", claude.listThreads()], ["chat-busy", claude.busy()],
        ["runs", listRuns()], ["strategies", listStrategies()], ["mt5", mt5State()],
      ]);
    }

    if (p === "/api/threads" && post) return json(claude.createThread());
    if ((m = p.match(/^\/api\/threads\/([\w-]+)$/))) {
      if (req.method === "DELETE") { claude.deleteThread(m[1]); return json({ ok: true }); }
      const ev = claude.threadEvents(m[1]);
      return ev ? json(ev) : json({ error: "not found" }, 404);
    }
    if (p === "/api/chat" && post) {
      const { threadId, message } = await req.json();
      if (!message?.trim()) return json({ error: "Empty message" }, 400);
      if (claude.busy()) return json({ error: "Claude is still working" }, 409);
      if (!claude.threadEvents(threadId)) return json({ error: "No such thread" }, 404);
      claude.send(threadId, message).catch((e) => console.error(e));
      return json({ ok: true });
    }
    if (p === "/api/chat/stop" && post) { claude.stop(); return json({ ok: true }); }

    if ((m = p.match(/^\/api\/strategies\/(\w+)\/backtest$/)) && post) {
      const err = rerun(m[1]);
      return err ? json({ error: err }, 409) : json({ ok: true });
    }
    if ((m = p.match(/^\/api\/runs\/([^/]+)\/files$/))) {
      const f = getRunFiles(m[1]);
      return f ? json(f) : json({ error: "not found" }, 404);
    }
    if ((m = p.match(/^\/api\/runs\/([^/]+)$/))) {
      const r = getRun(m[1]);
      return r ? json(r) : json({ error: "not found" }, 404);
    }

    // built front end; unknown paths fall back to the app
    const f = Bun.file(join(DIST, normalize(p)));
    if (p !== "/" && (await f.exists())) return new Response(f);
    return new Response(Bun.file(join(DIST, "index.html")));
  },
});

console.log(`Backtest Studio on http://127.0.0.1:${PORT}`);
