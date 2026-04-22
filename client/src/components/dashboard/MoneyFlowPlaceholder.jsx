export default function MoneyFlowPlaceholder() {
  const mockBars = [42, 28, 63, 54, 77, 49, 68]

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Insights
          </p>
          <h2 className="text-base font-semibold text-card-foreground sm:text-lg">
            Money Flow (Placeholder)
          </h2>
        </div>
        <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
          Weekly trend
        </span>
      </header>

      <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 p-4">
        <div className="flex h-36 items-end gap-2 sm:gap-3">
          {mockBars.map((bar, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-md bg-primary/75"
                style={{ height: `${bar}%` }}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Placeholder chart for upcoming money flow and transaction trend widget.
        </p>
      </div>
    </section>
  )
}
