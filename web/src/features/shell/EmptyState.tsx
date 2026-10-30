import { DotField } from "@/components/ui/dot-field";
import { Logo } from "./Logo";

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface">
      <DotField className="absolute inset-0 opacity-40" gradientFrom="rgba(242,242,243,0.25)" gradientTo="rgba(111,111,117,0.15)" />
      <div className="relative max-w-sm px-6 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <Logo size={44} />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{hint}</p>
        {action && (
          <button type="button" onClick={action.onClick}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-text-primary px-3.5 py-2 text-xs font-medium text-background shadow-xs transition-opacity hover:opacity-90 focus-ring">
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
