import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { inDesktop } from "@/lib/updates";
import { cn } from "@/lib/utils";

const win = async () => (await import("@tauri-apps/api/window")).getCurrentWindow();

// Minimise, maximise/restore and close for the undecorated desktop window.
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!inDesktop) return;
    let stop: (() => void) | undefined;
    win().then(async (w) => {
      setMaximized(await w.isMaximized());
      stop = await w.onResized(async () => setMaximized(await w.isMaximized()));
    });
    return () => stop?.();
  }, []);
  if (!inDesktop) return null;

  const btn = "grid h-10 w-11 place-items-center text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-ring";
  return (
    <div className="flex self-stretch">
      <button type="button" aria-label="Minimise" className={btn} onClick={() => win().then((w) => w.minimize())}>
        <Minus className="h-4 w-4" />
      </button>
      <button type="button" aria-label={maximized ? "Restore" : "Maximise"} className={btn} onClick={() => win().then((w) => w.toggleMaximize())}>
        {maximized ? <Copy className="h-3.5 w-3.5 -scale-x-100" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <button type="button" aria-label="Close" className={cn(btn, "hover:bg-rose-600 hover:text-white")} onClick={() => win().then((w) => w.close())}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Thin zones on the window's edges and corners: an undecorated window has no
// resize borders of its own on Wayland.
const EDGES = [
  ["North", "top-0 left-2 right-2 h-1 cursor-n-resize"],
  ["South", "bottom-0 left-2 right-2 h-1 cursor-s-resize"],
  ["West", "left-0 top-2 bottom-2 w-1 cursor-w-resize"],
  ["East", "right-0 top-2 bottom-2 w-1 cursor-e-resize"],
  ["NorthWest", "top-0 left-0 h-2 w-2 cursor-nw-resize"],
  ["NorthEast", "top-0 right-0 h-2 w-2 cursor-ne-resize"],
  ["SouthWest", "bottom-0 left-0 h-2 w-2 cursor-sw-resize"],
  ["SouthEast", "bottom-0 right-0 h-2 w-2 cursor-se-resize"],
] as const;

export function ResizeEdges() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!inDesktop) return;
    let stop: (() => void) | undefined;
    win().then(async (w) => {
      setMaximized(await w.isMaximized());
      stop = await w.onResized(async () => setMaximized(await w.isMaximized()));
    });
    return () => stop?.();
  }, []);
  if (!inDesktop || maximized) return null;
  return (
    <>
      {EDGES.map(([dir, cls]) => (
        <div key={dir} aria-hidden className={cn("fixed z-[60]", cls)}
          onPointerDown={(e) => { e.preventDefault(); win().then((w) => w.startResizeDragging(dir)); }} />
      ))}
    </>
  );
}
