// Self-update through Tauri's updater, only when running inside the desktop
// app (a browser on the source version has no updater). Checks at launch and
// every 6 hours; installing waits for the user's click.
import { useSyncExternalStore } from "react";
import type { Update } from "@tauri-apps/plugin-updater";

export const inDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type State = {
  version: string | null;            // running app version
  update: Update | null;             // newer release, when found
  phase: "idle" | "checking" | "downloading" | "installing" | "error" | "latest";
  progress: number;                  // 0..1 while downloading
  error: string | null;
};

let state: State = { version: null, update: null, phase: "idle", progress: 0, error: null };
const listeners = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };

export const useUpdates = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);

export async function checkForUpdates() {
  if (!inDesktop || state.phase === "downloading" || state.phase === "installing") return;
  set({ phase: "checking", error: null });
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    set({ update, phase: update ? "idle" : "latest" });
  } catch (e) {
    set({ phase: "error", error: String((e as Error)?.message ?? e) });
  }
}

export async function installUpdate() {
  const u = state.update;
  if (!u) return;
  let total = 0, got = 0;
  set({ phase: "downloading", progress: 0, error: null });
  try {
    await u.downloadAndInstall((ev) => {
      if (ev.event === "Started") total = ev.data.contentLength ?? 0;
      if (ev.event === "Progress") { got += ev.data.chunkLength; set({ progress: total ? got / total : 0 }); }
      if (ev.event === "Finished") set({ phase: "installing", progress: 1 });
    });
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    set({ phase: "error", error: String((e as Error)?.message ?? e) });
  }
}

export function startUpdateChecks() {
  if (!inDesktop) return;
  import("@tauri-apps/api/app").then(({ getVersion }) => getVersion()).then((version) => set({ version }));
  setTimeout(checkForUpdates, 5_000);
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}
