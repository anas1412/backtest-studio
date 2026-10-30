import { useMemo, useState } from "react";
import { Check, Search, Settings2 } from "lucide-react";
import { OriginDropdown } from "@/components/ui/origin-dropdown";
import { api, notify, useStudio } from "@/lib/api";
import type { EngineStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EnginesSheet } from "./EnginesSheet";

const EFFORT_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High", xhigh: "Extra high", max: "Max" };

// "Opus 5.5" for an engine's model id, or the id itself
export function modelLabel(engines: EngineStatus[], engine?: string, model?: string) {
  const e = engines.find((x) => x.id === engine);
  return e?.models.find((m) => m.id === model)?.label ?? model ?? "";
}
export function engineLabel(engines: EngineStatus[], engine?: string) {
  return engines.find((x) => x.id === engine)?.label ?? engine ?? "";
}

// One compact control in the composer: engine, model, effort. Lists only what
// is actually available (a detected CLI or a working key). Applies from the
// next message; each message records what answered it.
export function ModelPicker() {
  const engines = useStudio((s) => s.engines);
  const cur = useStudio((s) => s.chatSettings);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);

  const shownId = view ?? cur.engine;
  const shown = engines.find((e) => e.id === shownId);
  const available = engines.filter((e) => e.available);
  const curModel = engines.find((e) => e.id === cur.engine)?.models.find((m) => m.id === cur.model);

  const models = useMemo(() => {
    const all = shown?.models ?? [];
    const s = q.trim().toLowerCase();
    return (s ? all.filter((m) => m.id.toLowerCase().includes(s) || m.label.toLowerCase().includes(s)) : all).slice(0, 200);
  }, [shown, q]);

  const change = (patch: { engine?: string; model?: string; effort?: string }) =>
    api.setChatSettings(patch).catch((e) => notify({ tone: "error", title: "Not changed", description: e.message }));

  const pick = (model: string) => {
    const efforts = shown?.models.find((m) => m.id === model)?.efforts;
    // keep the effort when the new model has it, else its middle setting, else none
    const effort = efforts?.length ? (efforts.includes(cur.effort) ? cur.effort : efforts[Math.floor(efforts.length / 2)]) : "";
    change({ engine: shownId, model, effort });
    setOpen(false);
    setQ("");
  };

  const trigger = (
    <span className="flex max-w-[13rem] items-center gap-1.5 truncate">
      <span className="truncate">{curModel?.label ?? cur.model}</span>
      {cur.effort && curModel?.efforts?.length ? <span className="text-text-muted">· {EFFORT_LABEL[cur.effort] ?? cur.effort}</span> : null}
    </span>
  );

  return (
    <>
      <OriginDropdown side="top" open={open} onOpenChange={(o) => { setOpen(o); if (o) setView(null); }} trigger={trigger}>
        <div className="w-[min(22rem,80vw)] p-1.5 text-xs">
          <div className="flex flex-wrap gap-1 border-b border-border px-1 pb-2">
            {available.map((e) => (
              <button key={e.id} type="button" onClick={() => { setView(e.id); setQ(""); }}
                className={cn("rounded-full border px-2.5 py-1 transition-colors focus-ring",
                  e.id === shownId ? "border-border-hover bg-surface-hover text-text-primary" : "border-border text-text-secondary hover:text-text-primary")}>
                {e.label}
              </button>
            ))}
            {!available.length && <p className="px-1 py-1 text-text-muted">No AI engine found yet.</p>}
          </div>

          {shown?.available && (
            <>
              {shown.models.length > 8 && (
                <label className="mt-1.5 flex items-center gap-2 rounded-md border border-border px-2">
                  <Search className="h-3.5 w-3.5 text-text-muted" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${shown.models.length} models…`}
                    className="h-8 w-full bg-transparent outline-none placeholder:text-text-muted" />
                </label>
              )}
              <ul className="mt-1 max-h-56 overflow-y-auto">
                {models.map((m) => {
                  const active = cur.engine === shownId && cur.model === m.id;
                  return (
                    <li key={m.id}>
                      <button type="button" onClick={() => pick(m.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-hover focus-ring">
                        <Check className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{m.label}</span>
                        {m.label !== m.id && <span className="ml-auto truncate pl-2 text-[10px] text-text-muted">{m.id}</span>}
                      </button>
                    </li>
                  );
                })}
                {shown.customModels && q.trim() && !shown.models.some((m) => m.id === q.trim()) && (
                  <li>
                    <button type="button" onClick={() => pick(q.trim())}
                      className="w-full rounded-md px-2 py-1.5 text-left text-text-secondary hover:bg-surface-hover focus-ring">
                      Use model id “{q.trim()}”
                    </button>
                  </li>
                )}
              </ul>
            </>
          )}

          {cur.engine === shownId && curModel?.efforts?.length ? (
            <div className="mt-1.5 border-t border-border px-1 pt-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">Effort</p>
              <div className="flex gap-1">
                {curModel.efforts.map((ef) => (
                  <button key={ef} type="button" onClick={() => change({ effort: ef })}
                    className={cn("flex-1 rounded-md border px-1.5 py-1 transition-colors focus-ring",
                      cur.effort === ef ? "border-border-hover bg-surface-hover text-text-primary" : "border-border text-text-secondary hover:text-text-primary")}>
                    {EFFORT_LABEL[ef] ?? ef}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <button type="button" onClick={() => { setOpen(false); setSheet(true); }}
            className="mt-1.5 flex w-full items-center gap-2 rounded-md border-t border-border px-2 pb-1 pt-2 text-text-secondary hover:text-text-primary focus-ring">
            <Settings2 className="h-3.5 w-3.5" /> Engines & API keys…
          </button>
        </div>
      </OriginDropdown>
      <EnginesSheet open={sheet} onOpenChange={setSheet} />
    </>
  );
}
