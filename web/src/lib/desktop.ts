// The AppImage's place on the desktop (Linux desktop app only): where it
// runs from, the one-time move to ~/Applications, and the app-menu entry.
import { inDesktop } from "./updates";

export type Location = { appimage: string | null; in_applications: boolean; offer_move: boolean; launcher: boolean };

const call = async <T,>(cmd: string, args?: Record<string, unknown>) =>
  (await import("@tauri-apps/api/core")).invoke<T>(cmd, args);

export const appimageLocation = () => (inDesktop ? call<Location>("appimage_location") : Promise.resolve(null));
export const moveToApplications = () => call<void>("move_to_applications");
export const keepHere = () => call<void>("keep_here");
export const setLauncher = (enabled: boolean) => call<void>("set_launcher", { enabled });
