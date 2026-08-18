import RowIcon from '@/components/settings/RowIcon'

/**
 * IconRow, the canonical settings row: icon square + label + inline status pill
 * + optional detail/hint on the left, the action(s) on the right.
 *
 * `VerificationMethodRow` established this shape for security methods, and the
 * Default Card and Account status sections had each hand-rolled a copy of the
 * same markup. This is that one shape, so a row reads at identical weight
 * wherever it appears. `icon` and `pill` are optional — a row without either
 * keeps the same paddings and alignment.
 */
export default function IconRow({ icon, label, pill, detail, hint, action, tone = 'default' }) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-surface border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
        tone === 'danger' ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-background'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <RowIcon icon={icon} /> : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-card-foreground">{label}</p>
            {pill}
          </div>
          {detail ? (
            <p className="mt-1 break-all text-sm font-medium text-card-foreground">{detail}</p>
          ) : null}
          {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  )
}
