export default function DashboardWidgetShell({ title, summary, children }) {
  return (
    <section className="w-full max-w-full min-w-0 rounded-surface border border-border/70 bg-card/95 p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Card Portfolio Health
          </p>
          <h2 className="mt-1 text-lg font-semibold sm:text-xl">{title}</h2>
        </div>
        <div className="w-full shrink-0 rounded-input border border-border bg-background px-3 py-2 text-right shadow-sm sm:w-auto sm:px-4">
          <p className="text-xl font-bold leading-none tabular-nums sm:text-2xl">{summary}</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            Total Cards
          </p>
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </section>
  )
}
