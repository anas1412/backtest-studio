import { join, normalize } from "node:path";
import { WEB } from "./paths";
import { subscribe, broadcast } from "./events";
import * as claude from "./claude";
import { listRuns, getRun, getRunFiles, getStrategyFiles, listStrategies, getSettings, saveSettings, mt5State, rerun, startWatching } from "./runs";
import { listSymbols, refreshSymbols } from "./symbols";
import { getInputs, saveInputs } from "./inputs";
import { listProfiles, putProfile, deleteProfile } from "./profiles";
import { account, liveStatus, startLive, stopLive, liveLog } from "./live";
import { busyWith } from "./mt5";
import { terminalRunning } from "./platform";
import { rmSync } from "node:fs";
import { LIVE_FILE } from "./paths";

const PORT = Number(process.env.PORT ?? 4747);
const DIST = join(WEB, "dist");
startWatching();

// Live status to the pages; if MT5 was closed by hand, live trading ended.
let lastLive = "";
setInterval(() => {
  const st = liveStatus();
  if (st && !st.running && !busyWith() && !terminalRunning()) {
    rmSync(LIVE_FILE, { force: true });
    broadcast("notice", { tone: "warning", title: "Live trading stopped", description: `MT5 was closed, so ${st.strategy} is no longer trading.` });
  }
  const now = JSON.stringify(liveStatus());
  if (now !== lastLive) broadcast("live", JSON.parse((lastLive = now)));
}, 2000);

const json = (d: unknown, status = 200) => Response.json(d, { status });

// Saves edits from the Go live sheet before starting, like a backtest run does.
function saveEdits(name: string, settings?: Record<string, string>, inputs?: Record<string, string>): string | null {
  if (!getSettings(name)) return "No such strategy";
  if (settings) saveSettings(name, settings);
  if (inputs) saveInputs(name, inputs);
  return null;
}

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
        ["chat-settings", claude.chatSettings()], ["live", liveStatus()],
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
    if (p === "/api/chat/settings" && post) {
      const err = claude.setChatSettings(await req.json());
      return err ? json({ error: err }, 400) : json(claude.chatSettings());
    }

    if (p === "/api/symbols") return json(listSymbols());
    if (p === "/api/symbols/refresh" && post) {
      refreshSymbols().then((err) => broadcast("notice", err
        ? { tone: "error", title: "Couldn't read symbols from MT5", description: err }
        : { tone: "success", title: "Symbols updated from MT5", description: `${listSymbols().symbols.length} symbols` }));
      return json({ ok: true });
    }
    if (p === "/api/rule-profiles") {
      if (post) {
        const err = putProfile(await req.json());
        if (err) return json({ error: err }, 400);
      }
      return json(listProfiles());
    }
    if ((m = p.match(/^\/api\/rule-profiles\/(.+)$/)) && req.method === "DELETE") {
      deleteProfile(decodeURIComponent(m[1]));
      return json(listProfiles());
    }
    if (p === "/api/live") return json({ status: liveStatus(), account: account(), log: liveLog() });
    if (p === "/api/live/start" && post) {
      const { strategy, settings, inputs } = await req.json();
      if (!getInputs(strategy)) return json({ error: "No such strategy" }, 404);
      if (settings || inputs) {
        const err = saveEdits(strategy, settings, inputs);
        if (err) return json({ error: err }, 400);
      }
      const r = await startLive(strategy);
      return r.error ? json({ error: r.error }, 409) : json(r.info);
    }
    if (p === "/api/live/stop" && post) { await stopLive(); return json({ ok: true }); }
    if ((m = p.match(/^\/api\/strategies\/(\w+)\/inputs$/))) {
      const i = getInputs(m[1]);
      return i ? json(i) : json({ error: "not found" }, 404);
    }
    if ((m = p.match(/^\/api\/strategies\/(\w+)\/files$/))) {
      const f = getStrategyFiles(m[1]);
      return f ? json(f) : json({ error: "not found" }, 404);
    }
    if ((m = p.match(/^\/api\/strategies\/(\w+)\/settings$/))) {
      const s = getSettings(m[1]);
      return s ? json(s) : json({ error: "not found" }, 404);
    }

    if ((m = p.match(/^\/api\/strategies\/(\w+)\/backtest$/)) && post) {
      const body = req.headers.get("content-length") !== "0" ? await req.json().catch(() => ({})) : {};
      const err = rerun(m[1], body.settings, body.inputs);
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
