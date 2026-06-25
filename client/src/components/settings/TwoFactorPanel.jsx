import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, ShieldOff, Smartphone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import ActionRow from '@/components/settings/ActionRow'
import { confirmTotp, disableTotp, setupTotp } from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'

function SetupModal({ onClose, onEnabled }) {
  const [setupData, setSetupData] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const startSetup = useCallback(async () => {
    setIsLoading(true)
    setError('')
    setSetupData(null)
    try {
      const data = await setupTotp()
      setSetupData(data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start 2FA setup. Check that the API is running.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    startSetup()
  }, [startSetup])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function handleConfirm(e) {
    e.preventDefault()
    if (code.length !== 6) return
    setIsLoading(true)
    setError('')
    try {
      await confirmTotp({ code })
      onEnabled()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid code. Try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  function handleCopy() {
    if (!setupData?.secret) return
    navigator.clipboard.writeText(setupData.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="totp-setup-title"
    >
      <div className="relative w-full max-w-sm rounded-panel border border-border bg-popover p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 id="totp-setup-title" className="pr-8 text-base font-semibold text-card-foreground mb-1">
          Set up authenticator app
        </h3>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          Scan the QR code with Google Authenticator, Authy, or any TOTP app. Once active,
          you can use codes to approve sensitive payments too.
        </p>

        {error ? (
          <div className="mb-5">
            <FormBanner variant="error" message={error} />
          </div>
        ) : null}

        {isLoading ? (
          <>
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
            <div className="mt-6 flex justify-end border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        ) : setupData ? (
          <>
            {/* QR code via Google Charts API replacement — use an inline QR URI display */}
            <div className="mb-5 flex flex-col items-center gap-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(setupData.uri)}&size=180x180`}
                alt="Scan with authenticator app"
                className="rounded-input border border-border"
                width={180}
                height={180}
              />
              <div className="w-full rounded-input border border-border bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground break-all">{setupData.secret}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Can&apos;t scan? Enter the key above manually.
              </p>
            </div>

            <form onSubmit={handleConfirm} className="mt-2 space-y-5 border-t border-border pt-5">
              <div className="space-y-1.5">
                <label htmlFor="totp-confirm" className="text-sm font-medium text-card-foreground">
                  Enter the 6-digit code to confirm
                </label>
                <input
                  id="totp-confirm"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isLoading}
                  autoFocus
                  className="w-full rounded-input border border-border bg-background px-3 py-2 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isLoading || code.length !== 6}
                  className="flex-1"
                >
                  {isLoading ? 'Verifying...' : 'Activate 2FA'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="mt-2 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row">
            <Button type="button" className="flex-1" onClick={startSetup}>
              Try again
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function DisableModal({ onClose, onDisabled }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleDisable(e) {
    e.preventDefault()
    if (code.length !== 6) return
    setIsLoading(true)
    setError('')
    try {
      await disableTotp({ code })
      onDisabled()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid code.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-panel border border-border bg-popover p-6 shadow-xl">
        <h3 className="text-base font-semibold text-card-foreground mb-1">Disable two-factor authentication</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Enter the current code from your authenticator app to confirm.
        </p>

        <FormBanner variant="error" message={error} />

        <form onSubmit={handleDisable} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={isLoading}
            autoFocus
            className="w-full rounded-input border border-border bg-background px-3 py-2 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              disabled={isLoading || code.length !== 6}
              className="flex-1"
            >
              {isLoading ? 'Disabling...' : 'Disable 2FA'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TwoFactorPanel({ enabled, onStatusChange }) {
  const [showSetup, setShowSetup] = useState(false)
  const [showDisable, setShowDisable] = useState(false)

  return (
    <>
      {showSetup && (
        <SetupModal
          onClose={() => setShowSetup(false)}
          onEnabled={() => { setShowSetup(false); onStatusChange(true) }}
        />
      )}
      {showDisable && (
        <DisableModal
          onClose={() => setShowDisable(false)}
          onDisabled={() => { setShowDisable(false); onStatusChange(false) }}
        />
      )}

      <div className="rounded-surface border border-border bg-emphasis px-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-input border ${enabled ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground'}`}>
              <Smartphone className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-card-foreground">Authenticator app</p>
                {enabled ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Not enabled
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {enabled
                  ? 'Login requires a code from your authenticator app.'
                  : 'Add a second layer of security to your account.'}
              </p>
            </div>
          </div>
          {enabled && <ShieldOff className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />}
        </div>
      </div>

      <ActionRow
        label="Two-factor authentication"
        value={enabled ? 'Enabled' : 'Disabled'}
        hint={enabled
          ? 'Requires your current authenticator code to disable.'
          : 'Use an authenticator app like Google Authenticator or Authy.'}
        action={
          enabled ? (
            <Button
              variant="outline"
              className="w-full sm:w-auto border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/50"
              onClick={() => setShowDisable(true)}
            >
              <ShieldOff className="h-4 w-4" />
              Disable 2FA
            </Button>
          ) : (
            <Button className="w-full sm:w-auto" onClick={() => setShowSetup(true)}>
              <Smartphone className="h-4 w-4" />
              Enable 2FA
            </Button>
          )
        }
      />
    </>
  )
}
