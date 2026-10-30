// Desktop-app helpers: saving a file through the system's Save dialog, and
// (Linux AppImage only) where it runs from, the one-time move to
// ~/Applications, and the app-menu entry.
import { inDesktop } from "./updates";

export type Location = { appimage: string | null; in_applications: boolean; offer_move: boolean; launcher: boolean };

const call = async <T,>(cmd: string, args?: Record<string, unknown>) =>
  (await import("@tauri-apps/api/core")).invoke<T>(cmd, args);

export const appimageLocation = () => (inDesktop ? call<Location>("appimage_location") : Promise.resolve(null));
export const moveToApplications = () => call<void>("move_to_applications");
export const keepHere = () => call<void>("keep_here");
export const setLauncher = (enabled: boolean) => call<void>("set_launcher", { enabled });

// Saves a file the UI made: the Save dialog in the desktop app (resolves to
// the chosen path, or null when cancelled), a normal download in a browser.
export async function saveFile(name: string, data: Blob): Promise<string | null> {
  if (inDesktop) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string | null>("save_file", await data.arrayBuffer(), { headers: { "x-file-name": name } });
  }
  const url = URL.createObjectURL(data);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}
