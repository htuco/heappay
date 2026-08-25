import { CheckCircle2, Minus, XCircle } from 'lucide-react'

import { AUDIT_OUTCOME, auditEventLabel, auditEventOutcome } from '@/utils/auditLog.utils'

/**
 * The event pill in the audit-log table, toned by outcome so a page of events
 * scans at a glance.
 *
 * Shape and palette mirror the settings `StatusPill` (soft tint + hairline
 * border) rather than the solid `Badge` variants — 20 solid `border-2 font-bold`
 * pills in a dense table read as a wall of colour.
 *
 * The colour is never the only carrier of meaning: the label text ("Login
 * failed") states the outcome, and each tone gets its own icon, so the table
 * still parses in greyscale and for colour-blind readers.
 */
const TONES = {
  [AUDIT_OUTCOME.SUCCESS]: {
    className: 'border-success/30 bg-success/10 text-success',
    icon: CheckCircle2,
  },
  [AUDIT_OUTCOME.NEGATIVE]: {
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
    icon: XCircle,
  },
  [AUDIT_OUTCOME.NEUTRAL]: {
    className: 'border-border bg-muted/40 text-muted-foreground',
    icon: Minus,
  },
}

export default function AuditEventBadge({ event }) {
  const tone = TONES[auditEventOutcome(event?.event_type)] ?? TONES[AUDIT_OUTCOME.NEUTRAL]
  const Icon = tone.icon
  const label = auditEventLabel(event)

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone.className}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
    </span>
  )
}
