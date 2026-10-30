import { useEffect, useState } from "react";
import { CodeBlock } from "@/components/ui/ai-response";
import { SkeletonText } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type Files = { source: string; ini: string; log: string };

function useFiles(runId: string) {
  const [files, setFiles] = useState<Files | null>(null);
  useEffect(() => {
    setFiles(null);
    api.runFiles(runId).then(setFiles).catch(() => setFiles({ source: "", ini: "", log: "" }));
  }, [runId]);
  return files;
}

export function CodeView({ runId, strategy }: { runId: string; strategy: string }) {
  const f = useFiles(runId);
  if (!f) return <SkeletonText lines={8} />;
  return (
    <div>
      <CodeBlock language="mql5" filename={`${strategy}.mq5`} code={f.source || "// source not saved for this run"} />
      <CodeBlock language="ini" filename="tester.ini" code={f.ini} />
    </div>
  );
}

// The full MT5 summary as a definition grid, then the tester log.
export function ReportView({ runId, summary }: { runId: string; summary: Record<string, string> }) {
  const f = useFiles(runId);
  const skip = new Set(["Inputs", "Company"]);
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-2 text-xs" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}>
        {Object.entries(summary).filter(([k]) => !skip.has(k)).map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-1.5">
            <dt className="text-text-muted">{k}</dt>
            <dd className="font-medium tabular-nums text-text-primary text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {f ? <CodeBlock language="log" filename="tester.log" code={f.log || "No tester log"} /> : <SkeletonText lines={6} />}
    </div>
  );
}
