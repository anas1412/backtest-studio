import { AdvancedDataTable, type ColumnDef } from "@/components/ui/advanced-data-table";
import { Badge } from "@/components/ui/badge";
import type { Trade } from "@/lib/types";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = Trade & { n: number; result: string };

export function TradesTable({ trades, onPick }: { trades: Trade[]; onPick: (t: Trade) => void }) {
  const rows: Row[] = trades.map((t, i) => ({ ...t, n: i + 1, result: t.profit >= 0 ? "win" : "loss" }));

  const columns: ColumnDef<Row>[] = [
    { id: "n", header: "#", accessorKey: "n", sortable: true, width: "56px" },
    {
      id: "side", header: "Side", accessorKey: "side", sortable: true, filterable: true,
      filterOptions: [{ label: "Buy", value: "buy" }, { label: "Sell", value: "sell" }],
      cell: ({ value }) => <Badge tone={value === "buy" ? "success" : "danger"}>{value}</Badge>,
    },
    { id: "volume", header: "Lots", accessorKey: "volume", sortable: true, align: "right", priority: "low" },
    { id: "entryTime", header: "Entry", accessorKey: "entryTime", sortable: true, priority: "medium" },
    { id: "entryPrice", header: "Entry price", accessorKey: "entryPrice", align: "right", priority: "low" },
    { id: "exitTime", header: "Exit", accessorKey: "exitTime", sortable: true, priority: "medium" },
    { id: "exitPrice", header: "Exit price", accessorKey: "exitPrice", align: "right", priority: "low" },
    {
      id: "result", header: "Result", accessorKey: "result", filterable: true,
      filterOptions: [{ label: "Win", value: "win" }, { label: "Loss", value: "loss" }],
      cell: ({ row }) => (
        <span className={cn("tabular-nums font-medium", row.profit >= 0 ? "text-emerald-500" : "text-rose-500")}>
          {row.profit >= 0 ? "+" : ""}{money(row.profit)}
        </span>
      ),
      sortable: true, align: "right", priority: "high",
    },
    { id: "balance", header: "Balance", accessorKey: "balance", cell: ({ value }) => money(value), align: "right", sortable: true },
  ];

  return (
    <AdvancedDataTable
      data={rows}
      columns={columns}
      title="Trades"
      searchPlaceholder="Search trades…"
      getRowId={(r) => String(r.n)}
      defaultPageSize={15}
      renderSubComponent={(r) => (
        <button type="button" onClick={() => onPick(r)} className="text-xs text-text-secondary underline underline-offset-2 hover:text-text-primary focus-ring">
          Show this trade on the chart
        </button>
      )}
    />
  );
}
