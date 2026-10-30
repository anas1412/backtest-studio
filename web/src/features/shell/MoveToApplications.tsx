import { useEffect, useState } from "react";
import { FolderInput } from "lucide-react";
import { SettleModal } from "@/components/ui/settle-modal";
import { MorphingButton, type ButtonStatusState } from "@/components/ui/morphing-button";
import { appimageLocation, keepHere, moveToApplications, type Location } from "@/lib/desktop";

// Asked once, when the AppImage runs from outside ~/Applications (from
// Downloads, say): move it there so the app-menu entry keeps working.
export function MoveToApplications() {
  const [loc, setLoc] = useState<Location | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ButtonStatusState>("idle");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    appimageLocation().then((l) => { setLoc(l); if (l?.offer_move) setOpen(true); }).catch(() => {});
  }, []);
  if (!loc?.appimage) return null;

  const later = () => { keepHere().catch(() => {}); setOpen(false); };
  const move = async () => {
    setStatus("loading");
    setError(null);
    try {
      await moveToApplications(); // the app restarts from the new place
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  };

  return (
    <SettleModal open={open} onClose={later} size="sm" closeOnBackdrop={false}
      title={<span className="flex items-center gap-2"><FolderInput className="h-4 w-4" /> Move to your Applications folder?</span>}
      description="Backtest Studio is running from a folder you might clean up. In Applications it stays in your app menu and keeps updating there."
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <button type="button" onClick={later} disabled={status === "loading"}
            className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-40 focus-ring">
            Keep it here
          </button>
          <MorphingButton status={status} onClick={move} idleText="Move" loadingText="Moving…" errorText="Try again"
            idleIcon={<FolderInput className="h-3.5 w-3.5" />} />
        </div>
      }>
      <p className="break-all rounded-lg bg-surface-hover px-3 py-2 font-mono text-[11px] text-text-muted">{loc.appimage}</p>
      <p className="mt-2 text-[11px] text-text-muted">It moves to ~/Applications/BacktestStudio.AppImage and restarts. Your strategies, chats and keys aren't affected.</p>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </SettleModal>
  );
}
