import { useEffect, useState } from "react";
import { ChevronDown, Save, Trash2 } from "lucide-react";
import { SpringSelect } from "@/components/ui/spring-select";
import { Input, Switch } from "@/components/ui/form";
import { api, notify } from "@/lib/api";
import type { RuleProfile, StrategyInput } from "@/lib/types";
import { cn } from "@/lib/utils";

const RISK_GROUP = "Risk & rules";
const NUMERIC = /^(u?(int|long|short|char)|double|float)$/;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 truncate text-[11px] font-medium text-text-muted" title={hint ?? label}>{label}</p>
      {children}
    </div>
  );
}

function InputField({ input, value, onChange }: { input: StrategyInput; value: string; onChange: (v: string) => void }) {
  const label = input.comment || input.name;
  const hint = `${input.name}, default ${input.options?.find((o) => o.value === input.default)?.label ?? input.default}`;
  if (input.options) {
    return <Field label={label} hint={hint}><SpringSelect options={input.options} value={value} onChange={onChange} /></Field>;
  }
  if (input.type === "bool") {
    return (
      <Field label={label} hint={hint}>
        <div className="flex h-9 items-center"><Switch checked={value === "true"} onChange={(c) => onChange(c ? "true" : "false")} /></div>
      </Field>
    );
  }
  const numeric = NUMERIC.test(input.type);
  return (
    <Field label={label} hint={hint}>
      <Input value={value} inputMode={numeric ? "decimal" : "text"}
        onChange={(e) => onChange(numeric ? e.target.value.replace(/[^\d.-]/g, "") : e.target.value)} />
    </Field>
  );
}

const grid = { gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold text-text-secondary">{title}</p>
      <div className="grid gap-3" style={grid}>{children}</div>
    </div>
  );
}

// Which risk fields matter given the others (no point showing "money per
// trade" in % mode, or the daily basis while the daily limit is off).
function riskSections(v: Record<string, string>) {
  const on = (k: string) => Number(v[k] ?? 0) > 0;
  const mode = v.InpRiskMode ?? "0";
  return [
    { title: "Position size", keys: ["InpRiskMode", mode === "0" ? "InpRiskPercent" : mode === "1" ? "InpRiskMoney" : "InpFixedLots", "InpAccountSize"] },
    { title: "Daily loss", keys: ["InpDailyLossPct", ...(on("InpDailyLossPct") ? ["InpDailyLossOf", "InpDayStartValue", "InpDayResetHour"] : [])] },
    { title: "Max loss", keys: ["InpMaxLossPct", ...(on("InpMaxLossPct") ? ["InpMaxLossType"] : [])] },
    {
      title: "Target and limits",
      keys: ["InpProfitTargetPct", ...(on("InpProfitTargetPct") ? ["InpStopAtTarget"] : []), "InpMaxTradesPerDay",
        ...(on("InpDailyLossPct") || on("InpMaxLossPct") ? ["InpLimitBuffer", "InpCloseAtLimit"] : [])],
    },
  ];
}

function RiskCard({ inputs, values, onChange }: {
  inputs: StrategyInput[]; values: Record<string, string>; onChange: (patch: Record<string, string>) => void;
}) {
  const [profiles, setProfiles] = useState<RuleProfile[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => { api.ruleProfiles().then(setProfiles); }, []);

  const byName = new Map(inputs.map((i) => [i.name, i]));
  const mine = (vals: Record<string, string>) => Object.fromEntries(inputs.map((i) => [i.name, vals[i.name] ?? i.value]));
  const current = mine(values);
  const match = profiles.find((p) => inputs.every((i) => (p.values[i.name] ?? i.value) === current[i.name]));

  const saveAs = async () => {
    try {
      setProfiles(await api.saveProfile({ name, values: current }));
      setNaming(false);
      notify({ tone: "success", title: `Saved profile "${name.trim()}"`, description: "Pick it on any strategy to apply the same risk and rules." });
    } catch (e) {
      notify({ tone: "error", title: "Not saved", description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Rules profile">
          <SpringSelect className="w-60" placeholder={profiles.length ? "Pick a saved profile…" : "No saved profiles yet"}
            options={[...profiles.map((p) => ({ value: p.name, label: p.name })), { value: "", label: "Custom (unsaved)", disabled: true }]}
            value={match?.name ?? ""} onChange={(n) => { const p = profiles.find((x) => x.name === n); if (p) onChange(mine(p.values)); }} />
        </Field>
        {naming ? (
          <div className="flex items-center gap-2">
            <Input autoFocus className="w-56" placeholder="e.g. Prop 100K 1-step" value={name}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveAs()} />
            <button type="button" onClick={saveAs} disabled={!name.trim()}
              className="h-9 rounded-lg bg-text-primary px-3 text-xs font-medium text-background disabled:opacity-40 focus-ring">Save</button>
            <button type="button" onClick={() => setNaming(false)} className="h-9 px-2 text-xs text-text-muted hover:text-text-primary focus-ring">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => { setName(""); setNaming(true); }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary hover:text-text-primary focus-ring">
            <Save className="h-3.5 w-3.5" /> Save as profile
          </button>
        )}
        {match && !naming && (
          <button type="button" title={`Delete profile "${match.name}"`} aria-label="Delete profile"
            onClick={async () => setProfiles(await api.deleteProfile(match.name))}
            className="inline-flex h-9 items-center rounded-lg border border-border px-2.5 text-text-muted hover:text-rose-500 focus-ring">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {riskSections(current).map((s) => (
        <Section key={s.title} title={s.title}>
          {s.keys.map((k) => byName.get(k)).filter(Boolean).map((i) => (
            <InputField key={i!.name} input={i!} value={current[i!.name]} onChange={(v) => onChange({ [i!.name]: v })} />
          ))}
        </Section>
      ))}
      <p className="text-[11px] text-text-muted">
        Limits are checked on equity, so floating losses count. The buffer stops new trades before the limit because a
        fast market can carry an open trade past the point where it is closed.
      </p>
    </div>
  );
}

// "1% per trade · daily 3% · max 10% static · target 10%"
function riskSummary(inputs: StrategyInput[], v: Record<string, string>) {
  const get = (k: string) => v[k] ?? inputs.find((i) => i.name === k)?.value ?? "";
  const label = (k: string) => inputs.find((i) => i.name === k)?.options?.find((o) => o.value === get(k))?.label ?? "";
  const mode = get("InpRiskMode");
  const parts = [mode === "0" ? `${get("InpRiskPercent")}% per trade` : mode === "1" ? `${get("InpRiskMoney")} per trade` : `${get("InpFixedLots")} lots`];
  if (Number(get("InpDailyLossPct")) > 0) parts.push(`daily ${get("InpDailyLossPct")}%`);
  if (Number(get("InpMaxLossPct")) > 0) parts.push(`max ${get("InpMaxLossPct")}% ${label("InpMaxLossType").split(":")[0].toLowerCase()}`);
  if (Number(get("InpProfitTargetPct")) > 0) parts.push(`target ${get("InpProfitTargetPct")}%`);
  if (parts.length === 1) parts.push("no account limits");
  return parts.join(" · ");
}

// The strategy's inputs, grouped the way the EA declares them.
export function InputsPanel({ inputs, values, onChange }: {
  inputs: StrategyInput[]; values: Record<string, string>; onChange: (next: Record<string, string>) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const groups = [...new Set(inputs.map((i) => i.group))];
  const risk = inputs.filter((i) => i.group === RISK_GROUP);
  const set = (patch: Record<string, string>) => onChange({ ...values, ...patch });
  const value = (i: StrategyInput) => values[i.name] ?? i.value;

  return (
    <div className="divide-y divide-border">
      {risk.length > 0 ? (
        <div className="p-3">
          <button type="button" onClick={() => setRiskOpen(!riskOpen)} aria-expanded={riskOpen}
            className="flex w-full items-center gap-2 text-left focus-ring">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{RISK_GROUP}</span>
            <span className="truncate text-xs text-text-secondary">{riskSummary(risk, values)}</span>
            <ChevronDown className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-text-muted transition-transform", riskOpen && "rotate-180")} />
          </button>
          {riskOpen && <div className="mt-3"><RiskCard inputs={risk} values={values} onChange={set} /></div>}
        </div>
      ) : (
        <p className="p-3 text-[11px] text-text-muted">
          This strategy sizes trades its own way. Ask Claude to “use the studio risk module” to get risk-% sizing and account rules.
        </p>
      )}
      {groups.filter((g) => g !== RISK_GROUP && g !== "Advanced").map((g) => (
        <div key={g} className="p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{g}</p>
          <div className="grid gap-3" style={grid}>
            {inputs.filter((i) => i.group === g).map((i) => <InputField key={i.name} input={i} value={value(i)} onChange={(v) => set({ [i.name]: v })} />)}
          </div>
        </div>
      ))}
      {groups.includes("Advanced") && (
        <div className="p-3">
          <button type="button" onClick={() => setAdvanced(!advanced)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary focus-ring">
            Advanced <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advanced && "rotate-180")} />
          </button>
          {advanced && (
            <div className="mt-2 grid gap-3" style={grid}>
              {inputs.filter((i) => i.group === "Advanced").map((i) => <InputField key={i.name} input={i} value={value(i)} onChange={(v) => set({ [i.name]: v })} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
