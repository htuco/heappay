export default function TransactionHistorySkeleton() {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="hidden px-4 py-2.5 @[560px]/tbl:grid @[560px]/tbl:grid-cols-[28px_1fr_84px_120px_84px_128px_92px] @[560px]/tbl:items-center @[560px]/tbl:gap-x-4"
        >
          <div className="size-7 animate-pulse rounded-input bg-muted" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted/60" />
          </div>
          <div className="h-3 w-12 animate-pulse rounded bg-muted/60" />
          <div className="h-5 w-20 animate-pulse rounded-chip bg-muted/60" />
          <div className="h-5 w-16 animate-pulse rounded-input bg-muted/60" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted/60" />
          <div className="ml-auto h-3 w-14 animate-pulse rounded bg-muted" />
        </div>
      ))}
      {/* Mobile skeleton */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={`m-${i}`} className="flex items-center gap-3 px-4 py-2.5 @[560px]/tbl:hidden">
          <div className="size-8 shrink-0 animate-pulse rounded-input bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-muted/60" />
          </div>
          <div className="h-3 w-12 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
