export default function DashboardWidgetShell({ title, summary, children }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Card Portfolio Health
          </p>
          <h2 className="mt-1 text-lg font-semibold sm:text-xl">{title}</h2>
        </div>
        <div className="rounded-xl border border-border bg-background px-3 py-2 text-right shadow-sm sm:px-4">
          <p className="text-xl font-bold leading-none tabular-nums sm:text-2xl">{summary}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
            Total Cards
          </p>
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </section>
  )
}
