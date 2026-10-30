import { useEffect, useState } from "react";
import { Check, ExternalLink, FolderOpen, RefreshCw } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { api, notify, useStudio } from "@/lib/api";
import type { Mt5Info } from "@/lib/types";
import { cn } from "@/lib/utils";

const isDemo = (server: string) => /demo|trial|sim/i.test(server);

function Choice({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-ring disabled:opacity-50",
        active ? "border-border-hover bg-surface-hover" : "border-border hover:bg-surface-hover",
      )}>
      <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", active ? "border-text-primary bg-text-primary text-background" : "border-border-hover")}>
        {active && <Check className="h-2.5 w-2.5" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

// Which MT5 install and which account the studio uses for backtests and
// live trading. Accounts are the ones MT5 has logged into; MT5 keeps the
// passwords, the studio only names the account.
export function Mt5Sheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const mt5 = useStudio((s) => s.mt5);
  const [info, setInfo] = useState<Mt5Info | null>(null);
  const busy = mt5 !== "ready";
  const load = () => api.mt5().then(setInfo);
  // reload when the window closes again: a new login shows up in the list
  useEffect(() => { if (open) load(); }, [open, mt5]);

  const pick = async (s: { dir?: string; login?: string; server?: string }) => {
    try {
      await api.mt5Select(s);
      await load();
    } catch (e) {
      notify({ tone: "warning", title: "Not changed", description: (e as Error).message });
    }
  };

  const chosen = info?.account;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[30rem]">
        <SheetHeader>
          <SheetTitle>MetaTrader 5</SheetTitle>
          <SheetDescription>The install and account used for backtests and live trading.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-6">
          {busy && (
            <Alert tone="info">
              <AlertDescription className="mt-0">
                {mt5 === "gui-open" ? "MT5 is open. Changes apply once it's closed." : "MT5 is busy. Changes are possible once it's idle."}
              </AlertDescription>
            </Alert>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Install</h3>
              <button type="button" onClick={load} className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary focus-ring">
                <RefreshCw className="h-3 w-3" /> Scan again
              </button>
            </div>
            {!info ? <Skeleton className="h-14 w-full rounded-xl" /> : info.installs.length === 0 ? (
              <Alert tone="warning">
                <AlertTitle>No MetaTrader 5 found</AlertTitle>
                <AlertDescription>Install MetaTrader 5 from your broker, start it once, then scan again. On Linux it must be in a Wine prefix (~/.wine*, Bottles).</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-1.5">
                {info.installs.map((i) => (
                  <Choice key={i.dir} active={i.dir === info.dir} disabled={busy} onClick={() => pick({ dir: i.dir })}>
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <FolderOpen className="h-3.5 w-3.5 text-text-muted" /> {i.name}
                      {!i.portable && <Badge tone="warning">new data folder</Badge>}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-text-muted" title={i.dir}>{i.dir}</span>
                  </Choice>
                ))}
              </div>
            )}
            {info?.installs.some((i) => !i.portable) && (
              <p className="mt-2 text-[11px] text-text-muted">
                “New data folder”: that MT5 keeps its data elsewhere. The studio runs MT5 with its data in the install folder,
                so log in once with Open MT5 below.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold">Account</h3>
            {!info ? <Skeleton className="h-28 w-full rounded-xl" /> : (
              <div className="space-y-1.5">
                <Choice active={!chosen} disabled={busy} onClick={() => pick({ login: "" })}>
                  <span className="block text-sm font-medium">Whatever MT5 last used</span>
                  <span className="text-[11px] text-text-muted">
                    {info.lastLogin.login ? `now ${info.lastLogin.login} · ${info.lastLogin.server}` : "no login yet"}
                  </span>
                </Choice>
                {info.accounts.map((a) => (
                  <Choice key={`${a.login}@${a.server}`} disabled={busy}
                    active={!!chosen && chosen.login === a.login && chosen.server === a.server}
                    onClick={() => pick({ login: a.login, server: a.server })}>
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium tabular-nums">
                      {a.login}
                      <span className="font-normal text-text-secondary">{a.server}</span>
                      {isDemo(a.server) ? <Badge tone="success">demo</Badge> : <Badge tone="danger">live server</Badge>}
                      {a.failed && <Badge tone="danger">last login failed</Badge>}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {a.failed ? `${a.failed}${a.lastSeen ? ` · last worked ${a.lastSeen}` : ""}` : a.lastSeen ? `last logged in ${a.lastSeen}` : "not logged in yet"}
                    </span>
                  </Choice>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border p-3">
            <h3 className="text-xs font-semibold">Use another account</h3>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[11px] text-text-secondary">
              <li>Open MT5 and log in: File → Login to Trade Account, tick “Save password”.</li>
              <li>Close MT5. The account appears in the list above.</li>
            </ol>
            <button type="button" disabled={busy}
              onClick={() => api.mt5Open().catch((e) => notify({ tone: "warning", title: "Can't open MT5", description: e.message }))}
              className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-40 focus-ring">
              <ExternalLink className="h-3.5 w-3.5" /> Open MT5
            </button>
          </section>

          <p className="text-[11px] text-text-muted">
            Accounts come from MT5's own login history. The studio never sees passwords: it tells MT5 which account to use and
            MT5 uses the password it saved. If that login fails, the test or live start stops and says why.
          </p>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
