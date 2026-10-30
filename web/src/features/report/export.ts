// "Export PDF": builds the report for a run and saves it (Save dialog in the
// desktop app, a download in a browser). The PDF library loads on first use.
import { createElement } from "react";
import { api } from "@/lib/api";
import { saveFile } from "@/lib/desktop";
import { reportData } from "./data";

export async function exportReport(runId: string, includeCode: boolean): Promise<string | null> {
  const [run, extra, { pdf }, { ReportDocument }] = await Promise.all([
    api.run(runId), api.runReport(runId), import("@react-pdf/renderer"), import("./ReportDocument"),
  ]);
  const data = reportData(run, extra, includeCode);
  const blob = await pdf(createElement(ReportDocument, { data }) as Parameters<typeof pdf>[0]).toBlob();
  return saveFile(`${run.meta.strategy} backtest ${run.meta.id.slice(0, 15)}.pdf`, blob);
}
