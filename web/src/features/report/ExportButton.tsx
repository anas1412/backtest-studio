import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { OriginDropdown } from "@/components/ui/origin-dropdown";
import { notify } from "@/lib/api";
import { exportReport } from "./export";

// Export the shown run as a PDF report, with or without the strategy's code.
export function ExportButton({ runId }: { runId: string }) {
  const [busy, setBusy] = useState(false);
  const run = async (includeCode: boolean) => {
    setBusy(true);
    try {
      const saved = await exportReport(runId, includeCode);
      if (saved) notify({ tone: "success", title: "Report saved", description: saved });
    } catch (e) {
      notify({ tone: "error", title: "Couldn't export the report", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <OriginDropdown side="bottom" className="[&>div[role=menu]]:right-0 [&>div[role=menu]]:left-auto"
      trigger={<span className="flex items-center gap-1.5 text-text-secondary">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} {busy ? "Exporting…" : "Export PDF"}
      </span>}
      items={[
        { id: "report", label: "Report", description: "Results, charts, settings and every trade", disabled: busy, onSelect: () => run(false) },
        { id: "code", label: "Report with code", description: "Also the strategy's MQL5 source", disabled: busy, onSelect: () => run(true) },
      ]} />
  );
}
