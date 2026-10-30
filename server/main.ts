import { join, normalize } from "node:path";
import { WEB } from "./paths";
import { subscribe, broadcast } from "./events";
import * as chat from "./chat";
import { engineStatuses } from "./engines/registry";
import { publicView as keysView, setProvider, removeProvider, type ProviderId } from "./keys";
import { listRuns, getRun, getRunFiles, getStrategyFiles, listStrategies, getSettings, saveSettings, mt5State, rerun, startWatching } from "./runs";
import { listSymbols, refreshSymbols } from "./symbols";
import { getInputs, saveInputs } from "./inputs";
import { listProfiles, putProfile, deleteProfile } from "./profiles";
import { account, liveStatus, startLive, stopLive, liveLog } from "./live";
import { busyWith } from "./mt5";
import { terminalRunning, startMt5Detached } from "./platform";
import { scanInstalls, accounts, select, mt5Dir, selectedAccount, lastLogin } from "./install";
import { linked } from "./links";
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
        ["threads", chat.listThreads()], ["chat-busy", chat.busy()],
        ["runs", listRuns()], ["strategies", listStrategies()], ["mt5", mt5State()],
        ["chat-settings", chat.chatSettings()], ["live", liveStatus()],
        ["mt5-config", { dir: mt5Dir(), account: selectedAccount() ?? lastLogin() }],
        ["engines", await engineStatuses()],
      ]);
    }

    if (p === "/api/threads" && post) return json(chat.createThread());
    if ((m = p.match(/^\/api\/threads\/([\w-]+)$/))) {
      if (req.method === "DELETE") { chat.deleteThread(m[1]); return json({ ok: true }); }
      const ev = chat.threadEvents(m[1]);
      return ev ? json(ev) : json({ error: "not found" }, 404);
    }
    if (p === "/api/chat" && post) {
      const { threadId, message } = await req.json();
      if (!message?.trim()) return json({ error: "Empty message" }, 400);
      if (chat.busy()) return json({ error: "Still working on the last message" }, 409);
      if (!chat.threadEvents(threadId)) return json({ error: "No such thread" }, 404);
      chat.send(threadId, message).catch((e) => console.error(e));
      return json({ ok: true });
    }
    if (p === "/api/chat/stop" && post) { chat.stop(); return json({ ok: true }); }
    if (p === "/api/chat/confirm" && post) {
      const { id, answer } = await req.json();
      return chat.answerConfirm(String(id), !!answer) ? json({ ok: true }) : json({ error: "Nothing waiting for an answer" }, 404);
    }
    if (p === "/api/engines") {
      const st = await engineStatuses(url.searchParams.has("refresh"));
      if (url.searchParams.has("refresh")) broadcast("engines", st);
      return json(st);
    }
    // API keys: the browser only ever gets masks back
    if (p === "/api/keys") return json(keysView());
    if ((m = p.match(/^\/api\/keys\/(\w+)$/))) {
      const id = m[1] as ProviderId;
      if (req.method === "DELETE") removeProvider(id);
      else if (post) {
        const err = setProvider(id, await req.json());
        if (err) return json({ error: err }, 400);
      }
      broadcast("engines", await engineStatuses(true)); // re-checks the key
      return json(keysView());
    }
    if (p === "/api/chat/settings" && post) {
      const err = await chat.setChatSettings(await req.json());
      return err ? json({ error: err }, 400) : json(chat.chatSettings());
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
    if (p === "/api/mt5") {
      return json({
        installs: scanInstalls(), dir: mt5Dir(), linked: linked(mt5Dir()),
        account: selectedAccount(), lastLogin: lastLogin(), accounts: accounts(),
      });
    }
    if (p === "/api/mt5/select" && post) {
      if (mt5State() !== "ready") return json({ error: "Wait until MT5 is idle (no backtest, not live, window closed)" }, 409);
      const err = select(await req.json());
      if (err) return json({ error: err }, 400);
      broadcast("mt5-config", { dir: mt5Dir(), account: selectedAccount() ?? lastLogin() });
      return json({ ok: true });
    }
    // opens the MT5 window as the studio uses it, to log into another account
    if (p === "/api/mt5/open" && post) {
      if (mt5State() !== "ready") return json({ error: "MT5 is already running or busy" }, 409);
      startMt5Detached("terminal64.exe", ["/portable"]);
      return json({ ok: true });
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
