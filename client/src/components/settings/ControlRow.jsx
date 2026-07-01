export default function ControlRow({ label, hint, children, emphasize = false, alignToggle = false }) {
  return (
    <div
      className={`rounded-surface border border-border px-4 py-4 ${
        emphasize ? 'bg-muted/30' : 'bg-background'
      }`}
    >
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:justify-between ${
          alignToggle ? 'sm:items-center' : 'sm:items-start'
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-card-foreground">{label}</p>
          {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
        </div>
        <div className={`w-full shrink-0 sm:w-auto ${alignToggle ? 'sm:pt-0' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
