export default function Toggle({ enabled = false, label, onToggle, disabled = false, busy = false }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={enabled}
      aria-busy={busy}
      className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-input border border-border bg-background px-3 py-2 transition-colors touch-manipulation hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 enabled:cursor-pointer disabled:pointer-events-none disabled:opacity-60 sm:w-auto sm:min-w-44 md:min-h-0"
    >
      {label ? (
        <span className="min-w-0 text-left text-sm font-medium text-card-foreground">{label}</span>
      ) : null}
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200 ${
          enabled ? 'border-primary bg-primary' : 'border-border bg-muted'
        }`}
      >
        <span
          className={`absolute h-5 w-5 rounded-full bg-card shadow-xs transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  )
}
