export default function SettingRow({ label, value, hint, emphasize = false }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between ${
        emphasize
          ? 'bg-[linear-gradient(135deg,rgba(167,76,255,0.08),transparent_75%)]'
          : 'bg-background'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-card-foreground">{label}</p>
        {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      <p className="text-sm font-medium text-card-foreground sm:max-w-[15rem] sm:text-right">
        {value}
      </p>
    </div>
  )
}
