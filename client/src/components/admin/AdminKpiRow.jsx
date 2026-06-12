const KPI_ITEMS = [
  { key: 'totalUsers', label: 'Total Users' },
  { key: 'activeUsers', label: 'Active Users' },
  { key: 'totalCards', label: 'Total Cards' },
  { key: 'disabledCards', label: 'Disabled Cards' },
]

function KpiCardSkeleton() {
  return (
    <article className="animate-pulse rounded-surface border border-border bg-card p-4">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="mt-3 h-8 w-16 rounded bg-muted" />
    </article>
  )
}

export default function AdminKpiRow({ kpiTotals, isLoading = false }) {
  if (isLoading) {
    return (
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-busy="true"
        aria-label="Loading admin metrics"
      >
        {KPI_ITEMS.map((item) => (
          <KpiCardSkeleton key={item.key} />
        ))}
      </section>
    )
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {KPI_ITEMS.map(({ key, label }) => {
        const value = kpiTotals[key]
        return (
          <article
            key={key}
            className="rounded-surface border border-border bg-card p-4"
            aria-label={`${label}: ${value}`}
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold text-card-foreground">{value}</p>
          </article>
        )
      })}
    </section>
  )
}
