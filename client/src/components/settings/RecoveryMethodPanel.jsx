import { CheckCircle2, KeyRound, Mail, ShieldCheck } from 'lucide-react'

import ActionRow from '@/components/settings/ActionRow'
import SettingRow from '@/components/settings/SettingRow'
import { Button } from '@/components/ui/button'

export default function RecoveryMethodPanel({ email, onChangePassword }) {
  const hasEmail = Boolean(email)

  return (
    <div className="space-y-3">
      <div className="rounded-surface border border-border bg-emphasis px-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-primary/20 bg-primary/10 text-primary">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-card-foreground">Email recovery</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </span>
              </div>
              <p className="mt-1 break-all text-sm font-medium text-card-foreground">
                {hasEmail ? email : 'No account email loaded'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This is the address used by the current backend for sign-in and account recovery.
              </p>
            </div>
          </div>
          <ShieldCheck className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
        </div>
      </div>

      <ActionRow
        label="Supported recovery action"
        value="Password change"
        hint="The backend supports changing your password while signed in. Reset-link email delivery is tracked separately."
        action={
          <Button className="w-full sm:w-auto" onClick={onChangePassword}>
            <KeyRound className="h-4 w-4" />
            Change Password
          </Button>
        }
      />

      <SettingRow
        label="Reset email link"
        value="Backend pending"
        hint="Tracked as AUTH-RECOVERY-001; no send-email button is shown until the API and mailer exist."
      />
    </div>
  )
}
