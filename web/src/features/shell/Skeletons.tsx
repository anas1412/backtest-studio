import { Skeleton, SkeletonAvatar, SkeletonText } from "@/components/ui/skeleton";

// Placeholders drawn in the shape of the real layout, so nothing jumps when
// the content arrives.

export function SettingsSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-end gap-3">
        {[224, 112, 176, 256, 112].map((w, i) => (
          <div key={i} style={{ width: w }}>
            <Skeleton className="mb-1.5 h-2.5 w-14" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="ml-auto h-[38px] w-[120px] rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-2.5 w-2/3" />
    </div>
  );
}

export function RunSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-2 h-2.5 w-24" />
            <Skeleton className="mt-4 h-12 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {[72, 80, 64, 72].map((w, i) => <Skeleton key={i} className="h-9 rounded-full" style={{ width: w }} />)}
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <Skeleton className="h-[52vh] min-h-[320px] w-full rounded-xl" />
        <Skeleton className="mt-4 h-[200px] w-full rounded-xl" />
      </div>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="mt-2 h-2.5 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
      <SettingsSkeleton />
      <RunSkeleton />
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-5 p-4" aria-label="Loading conversation">
      <div className="flex justify-end gap-2.5">
        <Skeleton className="h-10 w-2/3 rounded-2xl" />
        <SkeletonAvatar size={28} />
      </div>
      <div className="rounded-2xl border border-border p-4">
        <SkeletonText lines={4} />
      </div>
      <div className="rounded-xl border border-border p-4 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonAvatar size={20} />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
