import { MailWarning } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { resendVerificationEmail } from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'

export default function EmailVerificationBanner() {
  const { user } = useAuth()
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  if (!user || user.email_verified_at) return null

  async function handleResend() {
    setSending(true)
    setMessage('')
    try {
      await resendVerificationEmail()
      setMessage('Verification email sent. Check your inbox.')
    } catch (err) {
      setMessage(getApiErrorMessage(err, 'Could not resend verification email.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-surface border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <MailWarning className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <p className="font-medium leading-snug">
          {message || 'Verify your email to send payments, add cards, and more.'}
        </p>
      </div>
      <button
        type="button"
        onClick={handleResend}
        disabled={sending}
        className="shrink-0 rounded-input border border-warning/40 px-3 py-1.5 text-xs font-semibold text-warning hover:bg-warning/15 disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Resend verification email'}
      </button>
    </div>
  )
}
