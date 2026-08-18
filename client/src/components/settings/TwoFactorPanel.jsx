import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import VerificationMethodRow from '@/components/settings/VerificationMethodRow'
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4">
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

      <VerificationMethodRow
        label="Authenticator app"
        active={enabled}
        hint={enabled
          ? 'Login requires a code from your authenticator app. Disabling needs a current code.'
          : 'Use an app like Google Authenticator or Authy for a code at login.'}
        action={
          enabled ? (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setShowDisable(true)}
            >
              Disable
            </Button>
          ) : (
            <Button className="w-full sm:w-auto" onClick={() => setShowSetup(true)}>
              Enable
            </Button>
          )
        }
      />
    </>
  )
}
