import { useRef } from "react";
import { cn } from "@/lib/utils";

// The line between chat and results: drag it (or use the arrow keys when
// focused) to resize, double-click to reset. A thin line that grows and shows
// a grip on hover; the grabbable zone is wider than it looks.
export function SplitDivider({ onResize, onReset, onCollapse }: {
  onResize: (x: number) => void; onReset: () => void; onCollapse: () => void;
}) {
  const dragging = useRef(false);
  return (
    <div role="separator" aria-orientation="vertical" aria-label="Resize the chat" tabIndex={0}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId); // keeps fast drags (WebKitGTK drops them otherwise)
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => { if (dragging.current) onResize(e.clientX); }}
      onPointerUp={(e) => {
        dragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
        document.body.style.userSelect = "";
        // dropped against the left edge: hide the chat
        if (e.clientX < 120) onCollapse();
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        if (e.key === "ArrowLeft") onResize(box.left - 24);
        if (e.key === "ArrowRight") onResize(box.left + 24);
      }}
      className={cn(
        "group relative z-10 -mx-1.5 w-3 shrink-0 cursor-col-resize outline-none",
        "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border before:transition-all",
        "hover:before:w-0.5 hover:before:bg-border-hover focus-visible:before:w-0.5 focus-visible:before:bg-text-muted",
      )}>
      <span className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-hover opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}
