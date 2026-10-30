import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Combobox } from "@/components/ui/combobox";
import { SpringSelect } from "@/components/ui/spring-select";
import { DateRangeField } from "./DateRangeField";
import type { DateRange } from "@/components/ui/calendar";
import { Input, Switch, Textarea } from "@/components/ui/form";
import { api, notify } from "@/lib/api";
import type { SymbolList } from "@/lib/types";
import { TIMEFRAMES, dateToIni } from "@/lib/mt5";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">{label}</p>
      {children}
      {hint && <p className="mt-1 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

// Collects the idea and test settings, then hands them to Claude as one
// message in a fresh conversation. Claude names, writes and compiles it.
export function NewStrategySheet({ open, onOpenChange, onSent }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSent: (threadId: string) => void;
}) {
  const [idea, setIdea] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("XAUUSD");
  const [period, setPeriod] = useState("H1");
  const [range, setRange] = useState<DateRange>(() => {
    const to = new Date(); to.setHours(0, 0, 0, 0);
    const from = new Date(to); from.setFullYear(to.getFullYear() - 1);
    return { from, to };
  });
  const [runAfter, setRunAfter] = useState(true);
  const [symbols, setSymbols] = useState<SymbolList | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { if (open) api.symbols().then(setSymbols); }, [open]);
  const options = useMemo(() => (symbols?.symbols ?? []).map((s) => ({
    value: s.name, label: s.name,
    description: [s.description, s.history ? `history ${s.history[0]}–${s.history[1]}` : ""].filter(Boolean).join(" · "),
  })), [symbols]);

  const submit = async () => {
    if (!idea.trim() || !range.from || !range.to) return;
    setSending(true);
    const message = [
      `Create a new strategy${name.trim() ? ` named ${name.trim().replace(/\W+/g, "_")}` : ""}.`,
      "", idea.trim(), "",
      `Test settings: ${symbol} ${period}, ${dateToIni(range.from)} to ${dateToIni(range.to)}.`,
      runAfter ? "Compile it and run the backtest." : "Compile it but don't backtest yet.",
    ].join("\n");
    try {
      const thread = await api.newThread();
      onSent(thread.id);
      await api.send(thread.id, message);
      onOpenChange(false);
      setIdea(""); setName("");
    } catch (e) {
      notify({ tone: "error", title: "Not sent", description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[30rem]">
        <SheetHeader>
          <SheetTitle>New strategy</SheetTitle>
          <SheetDescription>Describe it in plain words. Claude writes the EA, compiles it and adds it to your strategies.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <Field label="Idea" hint="Entries, exits, stops, filters. Anything missing, Claude will ask or propose.">
            <Textarea rows={6} value={idea} onChange={(e) => setIdea(e.target.value)}
              placeholder="Buy when price closes above VWAP after the London open, stop below the session low, 2R target…" />
          </Field>
          <Field label="Name (optional)" hint="Letters, digits and underscores. Leave empty to let Claude name it.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="vwap_london" />
          </Field>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Symbol">
              <Combobox options={options} value={symbol} onValueChange={(v) => v && setSymbol(v)} searchPlaceholder="Search symbols…" />
            </Field>
            <Field label="Timeframe">
              <SpringSelect options={TIMEFRAMES.map((t) => ({ value: t, label: t }))} value={period} onChange={setPeriod} />
            </Field>
          </div>
          <Field label="Test dates">
            <DateRangeField value={range} onChange={setRange}
              historyStart={symbols?.symbols.find((s) => s.name === symbol)?.history?.[0]} />
          </Field>
          <Switch checked={runAfter} onChange={setRunAfter} label="Backtest it right away" description="Otherwise Claude only writes and compiles it." />
        </SheetBody>
        <SheetFooter>
          <button type="button" onClick={submit} disabled={!idea.trim() || sending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-text-primary text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40 focus-ring">
            <Sparkles className="h-4 w-4" /> {sending ? "Sending to Claude…" : "Create with Claude"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
