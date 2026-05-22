export default function ActionRow({ label, value, hint, action, tone = 'default' }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-surface border border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between ${
        tone === 'danger' ? 'bg-destructive/5' : 'bg-background'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-card-foreground">{label}</p>
        {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-[15rem] sm:items-end">
        <p className="text-sm font-medium text-card-foreground sm:text-right">{value}</p>
        {action}
      </div>
    </div>
  )
}
