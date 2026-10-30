import { useEffect, useState } from "react";
import { Radio, TriangleAlert } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DragToConfirm } from "@/components/ui/drag-to-confirm";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { api, notify, useStudio } from "@/lib/api";
import type { Account, Settings, StrategyInput } from "@/lib/types";

// Confirmation before live trading: which account, which strategy, with
// which inputs, and what starting it means. Slide to start.
export function GoLiveSheet({ open, onOpenChange, strategy, settings, inputs, onStarted }: {
  open: boolean; onOpenChange: (o: boolean) => void; strategy: string; settings: Settings;
  inputs: StrategyInput[]; onStarted: () => void;
}) {
  const live = useStudio((s) => s.live);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const lots = inputs.find((i) => /lot/i.test(i.name));

  useEffect(() => {
    if (!open) return;
    setError(null);
    api.live().then((l) => setAccount(l.account));
  }, [open]);

  const start = async () => {
    setStarting(true);
    try {
      await api.liveStart(strategy, settings, Object.fromEntries(inputs.map((i) => [i.name, i.value])));
      onStarted();
      onOpenChange(false);
      notify({ tone: "success", title: `${strategy} is live`, description: `${settings.Symbol} ${settings.Period} on account ${account?.login}` });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[28rem]">
        <SheetHeader>
          <SheetTitle>Trade {strategy} live</SheetTitle>
          <SheetDescription>MT5 starts with this strategy on a chart and algo trading on, then trades it by itself. Claude is not involved.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4 text-sm">
          <section className="rounded-xl border border-border p-3">
            <p className="text-[11px] font-medium text-text-muted">Account</p>
            {account ? (
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-medium tabular-nums">{account.login} · {account.server}</span>
                {account.demo ? <Badge tone="success" dot>demo server</Badge> : <Badge tone="danger" dot>not a demo server</Badge>}
              </div>
            ) : <Skeleton className="mt-2 h-4 w-48" />}
            {account?.demo && /ftmo/i.test(account.server) && (
              <p className="mt-2 text-[11px] text-text-muted">FTMO also runs paid challenges on this server. Make sure this is a free demo.</p>
            )}
          </section>

          <section className="rounded-xl border border-border p-3">
            <p className="text-[11px] font-medium text-text-muted">Chart</p>
            <p className="mt-1 font-medium">{settings.Symbol} · {settings.Period}</p>
            {lots && <p className="mt-1 text-xs text-text-secondary">Lot size <span className="font-semibold text-text-primary">{lots.value}</span></p>}
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {inputs.filter((i) => i !== lots).map((i) => (
                <div key={i.name} className="flex justify-between gap-2 border-b border-border-subtle py-0.5">
                  <dt className="truncate text-text-muted" title={i.comment}>{i.comment || i.name}</dt>
                  <dd className="tabular-nums">{i.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <ul className="space-y-1.5 text-xs text-text-secondary">
            <li>• While it trades, MT5 stays open, so backtests wait until you stop it.</li>
            <li>• Stopping closes MT5. Open positions stay open; close them in MT5 if you want.</li>
            <li>• Live fills and spreads are worse than in a backtest.</li>
            {live && <li className="text-amber-500">• {live.strategy} is live now; starting this replaces it.</li>}
          </ul>

          {error && (
            <Alert tone="danger" icon={<TriangleAlert className="h-4 w-4" />}>
              <AlertDescription className="mt-0 whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
          )}
        </SheetBody>
        <SheetFooter>
          <DragToConfirm key={String(open)} label={starting ? "Starting MT5…" : "Slide to start live trading"}
            confirmedLabel="Starting…" actionType="confirm" variant="warning" icon={<Radio className="h-4 w-4" />}
            disabled={!account || starting} onConfirm={start} autoResetDelay={3000} className="w-full" />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
