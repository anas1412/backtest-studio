import { useEffect, useState } from "react";
import { Check, Download, RefreshCw } from "lucide-react";
import { OriginDropdown } from "@/components/ui/origin-dropdown";
import { MorphingButton } from "@/components/ui/morphing-button";
import { checkForUpdates, inDesktop, installUpdate, useUpdates } from "@/lib/updates";

// Version and updates, in the title bar (desktop app only). Click to check;
// when a newer release exists it turns into a button with the details.
export function UpdateChip() {
  const { version, update, phase, progress, route, error } = useUpdates();
  const [justChecked, setJustChecked] = useState(false);
  useEffect(() => {
    if (phase !== "latest") return;
    setJustChecked(true);
    const t = setTimeout(() => setJustChecked(false), 4000);
    return () => clearTimeout(t);
  }, [phase]);
  if (!inDesktop) return null;

  if (!update) {
    return (
      <button type="button" onClick={checkForUpdates} disabled={phase === "checking"} title="Check for updates"
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus-ring">
        {phase === "checking" ? <><RefreshCw className="h-3 w-3 animate-spin" /> Checking…</>
          : justChecked ? <><Check className="h-3 w-3 text-emerald-500" /> Up to date</>
          : phase === "error" ? <span className="text-rose-400" title={error ?? ""}>Update check failed</span>
          : <>v{version ?? ""}</>}
      </button>
    );
  }

  const busy = phase === "downloading" || phase === "installing";
  return (
    <OriginDropdown side="bottom" className="[&>div[role=menu]]:right-0 [&>div[role=menu]]:left-auto"
      trigger={<span className="flex items-center gap-1.5 text-emerald-400"><Download className="h-3.5 w-3.5" />
        {busy ? `Updating ${Math.round(progress * 100)}%` : `Update ${update.version}`}</span>}>
      <div className="w-72 p-3 text-xs">
        <p className="text-sm font-semibold">Backtest Studio {update.version}</p>
        <p className="mt-0.5 text-text-muted">You have {version}. Restarting installs it; your strategies, chats and keys are kept.</p>
        {/* the release notes, without the install instructions after "---" */}
        {update.body && <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-text-secondary">{update.body.split("\n---")[0].trim()}</p>}
        {phase === "downloading" && (
          <>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-text-muted">{Math.round(progress * 100)}%{route ? ` · fastest server ${route}` : ""}</p>
          </>
        )}
        {phase === "error" && <p className="mt-2 text-rose-400">Update failed: {error}</p>}
        <MorphingButton className="mt-3 w-full" status={busy ? "loading" : "idle"} onClick={installUpdate}
          idleText={phase === "error" ? "Try again" : "Restart to update"} loadingText={phase === "installing" ? "Installing…" : "Downloading…"}
          idleIcon={<Download className="h-3.5 w-3.5" />} />
      </div>
    </OriginDropdown>
  );
}
