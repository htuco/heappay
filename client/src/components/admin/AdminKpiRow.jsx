export default function AdminKpiRow({ kpiTotals }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total Users</p>
        <p className="mt-1 text-2xl font-bold text-card-foreground">{kpiTotals.totalUsers}</p>
      </article>
      <article className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Active Users</p>
        <p className="mt-1 text-2xl font-bold text-card-foreground">{kpiTotals.activeUsers}</p>
      </article>
      <article className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total Cards</p>
        <p className="mt-1 text-2xl font-bold text-card-foreground">{kpiTotals.totalCards}</p>
      </article>
      <article className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Disabled Cards</p>
        <p className="mt-1 text-2xl font-bold text-card-foreground">{kpiTotals.disabledCards}</p>
      </article>
    </section>
  )
}
