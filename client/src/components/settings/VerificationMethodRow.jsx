import { CheckCircle2 } from 'lucide-react'

import IconRow from '@/components/settings/IconRow'
import StatusPill from '@/components/settings/StatusPill'

/**
 * VerificationMethodRow, one row for a way of proving identity (authenticator
 * app, biometrics, app PIN).
 *
 * A thin wrapper over `IconRow` that adds the on/off status pill, so a method
 * row and every other settings row share one shell. Rows inside a subsection
 * carry no icon square — the subsection header owns the icon, and the pill
 * carries the state.
 */
export default function VerificationMethodRow({ label, active, statusLabel, detail, hint, action }) {
  return (
    <IconRow
      label={label}
      detail={detail}
      hint={hint}
      action={action}
      pill={
        active ? (
          <StatusPill tone="success" icon={CheckCircle2}>
            {statusLabel ?? 'Active'}
          </StatusPill>
        ) : (
          <StatusPill>{statusLabel ?? 'Not enabled'}</StatusPill>
        )
      }
    />
  )
}
