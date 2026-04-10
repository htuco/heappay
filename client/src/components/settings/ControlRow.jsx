export default function ControlRow({ label, hint, children, emphasize = false }) {
  return (
    <div
      className={`rounded-2xl border border-border px-4 py-4 ${
        emphasize
          ? 'bg-[linear-gradient(135deg,rgba(167,76,255,0.08),transparent_75%)]'
          : 'bg-background'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-card-foreground">{label}</p>
          {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="w-full min-w-0 sm:ml-4 sm:w-auto">{children}</div>
      </div>
    </div>
  )
}
