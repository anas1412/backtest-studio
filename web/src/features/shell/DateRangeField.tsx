import { SpringSelect } from "@/components/ui/spring-select";
import { DateRangePicker } from "@/components/ui/date-picker";
import type { DateRange } from "@/components/ui/calendar";
import { RANGE_PRESETS, matchPreset, presetRange } from "@/lib/mt5";

// Calendar for exact dates plus quick ranges, so "last 3 years" is one click
// instead of paging back 36 months.
export function DateRangeField({ value, onChange, historyStart, className }: {
  value: DateRange; onChange: (r: DateRange) => void; historyStart?: number; className?: string;
}) {
  const preset = matchPreset(value.from, value.to, historyStart);
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <SpringSelect className="w-40 shrink-0"
        options={[...RANGE_PRESETS.map(({ value, label }) => ({ value, label })), { value: "custom", label: "Custom range", disabled: true }]}
        value={preset} onChange={(v) => onChange(presetRange(v, historyStart))} />
      <DateRangePicker className="min-w-0 flex-1" value={value} onChange={onChange}
        minDate={historyStart ? new Date(historyStart, 0, 1) : undefined} maxDate={new Date()} />
    </div>
  );
}
