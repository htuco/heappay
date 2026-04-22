export default function DashboardPlaceholder({ title, description, ctaLabel = "Coming soon" }) {
  return (
    <section className="rounded-3xl border border-dashed border-border bg-card/70 p-4 shadow-sm sm:p-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Placeholder
        </p>
        <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4 inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
        {ctaLabel}
      </div>
    </section>
  )
}
