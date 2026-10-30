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
  route: string | null;              // the download address that won the race
  error: string | null;
};

let state: State = { version: null, update: null, phase: "idle", progress: 0, route: null, error: null };
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

// Downloads through the app's install_update command, which takes the
// fastest of GitHub's download addresses, then restarts into the new version.
export async function installUpdate() {
  if (!state.update) return;
  set({ phase: "downloading", progress: 0, error: null, route: null });
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const stop = await listen<{ downloaded: number; total: number | null; route: string | null }>("update-progress", ({ payload }) => {
    const progress = payload.total ? payload.downloaded / payload.total : 0;
    set({ progress, route: payload.route, phase: progress >= 1 ? "installing" : "downloading" });
  });
  try {
    await invoke("install_update"); // restarts the app when done
  } catch (e) {
    set({ phase: "error", error: String((e as Error)?.message ?? e) });
  } finally {
    stop();
  }
}

export function startUpdateChecks() {
  if (!inDesktop) return;
  import("@tauri-apps/api/app").then(({ getVersion }) => getVersion()).then((version) => set({ version }));
  setTimeout(checkForUpdates, 5_000);
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}
