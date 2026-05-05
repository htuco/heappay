export default function SettingsCard({ title, description, icon: Icon, action, children }) {
  const IconComponent = Icon

  return (
    <section className="rounded-[24px] border border-border bg-card p-4 shadow-xs sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-muted p-2.5 text-primary">
              <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>
            </div>
          </div>
        </div>
        {action ? <div className="w-full sm:w-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}
