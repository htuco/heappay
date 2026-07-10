import { CheckCircle2 } from 'lucide-react'

/**
 * VerificationMethodRow, one consistent row for a way of proving identity
 * (authenticator app, biometrics, app PIN).
 *
 * Left: icon + name + inline status pill + one-line hint.
 * Right: the action button(s).
 *
 * Replaces the older pattern of a large status card stacked on top of a
 * separate action row, so every method reads at the same weight and the
 * section scans as a single list.
 */
export default function VerificationMethodRow({ icon, label, active, statusLabel, detail, hint, action }) {
  const IconComponent = icon

  return (
    <div className="flex flex-col gap-4 rounded-surface border border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-input border ${
            active
              ? 'border-primary/20 bg-primary/10 text-primary'
              : 'border-border bg-muted/40 text-muted-foreground'
          }`}
        >
          <IconComponent className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-card-foreground">{label}</p>
            {active ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                <CheckCircle2 className="h-3 w-3" />
                {statusLabel ?? 'Active'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {statusLabel ?? 'Not enabled'}
              </span>
            )}
          </div>
          {detail ? (
            <p className="mt-1 break-all text-sm font-medium text-card-foreground">{detail}</p>
          ) : null}
          {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      <div className="w-full shrink-0 sm:w-auto">{action}</div>
    </div>
  )
}
