import { useState } from "react";
import { Download, X } from "lucide-react";
import { MorphingButton } from "@/components/ui/morphing-button";
import { installUpdate, useUpdates } from "@/lib/updates";

// Shown in the desktop app when a newer release exists; installs on click.
export function UpdateCard() {
  const { update, phase, progress, error } = useUpdates();
  const [hidden, setHidden] = useState<string | null>(null);
  if (!update || hidden === update.version) return null;
  const busy = phase === "downloading" || phase === "installing";

  return (
    <div className="fixed bottom-5 left-5 z-40 w-80 rounded-2xl border border-border bg-surface p-4 shadow-elevated">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Update {update.version} available</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {phase === "downloading" ? `Downloading… ${Math.round(progress * 100)}%`
              : phase === "installing" ? "Installing, the app restarts in a moment"
              : phase === "error" ? `Update failed: ${error}`
              : "Restarts the app. Your strategies, chats and keys are kept."}
          </p>
          {phase === "downloading" && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
        </div>
        {!busy && (
          <button type="button" aria-label="Later" onClick={() => setHidden(update.version)} className="text-text-muted hover:text-text-primary focus-ring">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <MorphingButton className="mt-3 w-full" status={busy ? "loading" : "idle"} onClick={installUpdate}
        idleText={phase === "error" ? "Try again" : "Restart to update"} loadingText={phase === "installing" ? "Installing…" : "Downloading…"}
        idleIcon={<Download className="h-3.5 w-3.5" />} />
    </div>
  );
}
