import { Check } from "lucide-react";
import { OriginDropdown } from "@/components/ui/origin-dropdown";
import { api, notify, useStudio } from "@/lib/api";

export const MODEL_LABELS: Record<string, string> = {
  opus: "Opus 5.5", sonnet: "Sonnet 5.5", haiku: "Haiku 5.5", fable: "Fable 5.1",
};

const MODELS = [
  { id: "opus", description: "Strongest coder. Best for writing and fixing EAs" },
  { id: "sonnet", description: "Fast and capable, lower cost" },
  { id: "haiku", description: "Fastest and cheapest; weaker on MQL5" },
  { id: "fable", description: "Most capable, highest cost" },
];
const EFFORTS: Record<string, string> = { low: "Low", medium: "Medium", high: "High", xhigh: "Extra high", max: "Max" };

// Sits in the composer toolbar and opens upward. Applies from the next
// message; each sent message records what it used.
export function ModelPicker() {
  const { model, effort } = useStudio((s) => s.chatSettings);
  const change = (patch: { model?: string; effort?: string }) =>
    api.setChatSettings(patch).catch((e) => notify({ tone: "error", title: "Not changed", description: e.message }));
  const tick = (on: boolean) => (on ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />);

  return (
    <div className="flex items-center gap-1.5">
      <OriginDropdown side="top" trigger={<span>{MODEL_LABELS[model] ?? model}</span>}
        items={MODELS.map((m) => ({
          id: m.id, label: MODEL_LABELS[m.id], description: m.description,
          icon: tick(m.id === model), onSelect: () => change({ model: m.id }),
        }))} />
      <OriginDropdown side="top" trigger={<span>{EFFORTS[effort] ?? effort} effort</span>}
        items={Object.entries(EFFORTS).map(([id, label]) => ({
          id, label, icon: tick(id === effort), onSelect: () => change({ effort: id }),
        }))} />
    </div>
  );
}
