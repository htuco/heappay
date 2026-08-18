import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'

import VerificationMethodRow from '@/components/settings/VerificationMethodRow'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/input'
import { changeAppPin, disableAppPin, getAppPinStatus, setAppPin } from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'

function sanitizePin(value) {
	return value.replace(/\D/g, '').slice(0, 4)
}

function formatLockedUntil(value) {
	if (!value) return null
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return null
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function PinModal({ mode, onClose, onSaved }) {
	const isChange = mode === 'change'
	const isDisable = mode === 'disable'
	const [currentPassword, setCurrentPassword] = useState('')
	const [currentPin, setCurrentPin] = useState('')
	const [pin, setPin] = useState('')
	const [confirmPin, setConfirmPin] = useState('')
	const [error, setError] = useState('')
	const [isSaving, setIsSaving] = useState(false)

	useEffect(() => {
		const onKeyDown = (event) => {
			if (event.key === 'Escape') onClose()
		}
		document.addEventListener('keydown', onKeyDown)
		return () => document.removeEventListener('keydown', onKeyDown)
	}, [onClose])

	async function handleSubmit(event) {
		event.preventDefault()
		if (isSaving) return
		setError('')
		if (isDisable) {
			if (currentPin.length !== 4) {
				setError('Enter your current app PIN.')
				return
			}
		} else if (pin.length !== 4 || confirmPin.length !== 4) {
			setError('Enter a 4-digit app PIN.')
			return
		}
		if (!isDisable && pin !== confirmPin) {
			setError('PINs do not match.')
			return
		}
		if (isChange && currentPin.length !== 4) {
			setError('Enter your current app PIN.')
			return
		}
		if (!isChange && !isDisable && !currentPassword) {
			setError('Enter your current password to set an app PIN.')
			return
		}

		setIsSaving(true)
		try {
			const status = isDisable
				? await disableAppPin({ currentPin })
				: isChange
					? await changeAppPin({ currentPin, newPin: pin })
					: await setAppPin({ currentPassword, pin })
			onSaved(status)
		} catch (err) {
			setError(
				getApiErrorMessage(
					err,
					isDisable
						? 'Could not disable app PIN.'
						: isChange
							? 'Could not change app PIN.'
							: 'Could not set app PIN.',
				),
			)
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-xs"
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose()
			}}
			role="dialog"
			aria-modal="true"
			aria-labelledby="app-pin-title"
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

				<h3 id="app-pin-title" className="mb-1 pr-8 text-base font-semibold text-card-foreground">
					{isDisable ? 'Disable app PIN' : isChange ? 'Change app PIN' : 'Set app PIN'}
				</h3>
				<p className="mb-5 text-sm leading-relaxed text-muted-foreground">
					{isDisable
						? 'Enter your current app PIN to remove PIN protection from payments.'
						: 'Use a 4-digit PIN to confirm payments when Face ID or fingerprint is unavailable.'}
				</p>

				<FormBanner variant="error" message={error} />

				<form onSubmit={handleSubmit} className="mt-4 space-y-4">
					{isChange || isDisable ? (
						<div className="space-y-1.5">
							<label htmlFor="current-app-pin" className="text-sm font-medium text-card-foreground">
								Current app PIN
							</label>
							<Input
								id="current-app-pin"
								type="password"
								inputMode="numeric"
								maxLength={4}
								autoComplete="off"
								placeholder="0000"
								value={currentPin}
								onChange={(event) => setCurrentPin(sanitizePin(event.target.value))}
								className="text-center font-mono text-lg tracking-[0.6em]"
								disabled={isSaving}
								autoFocus
							/>
						</div>
					) : (
						<div className="space-y-1.5">
							<label htmlFor="current-password" className="text-sm font-medium text-card-foreground">
								Current password
							</label>
							<Input
								id="current-password"
								type="password"
								autoComplete="current-password"
								placeholder="Your login password"
								value={currentPassword}
								onChange={(event) => setCurrentPassword(event.target.value)}
								disabled={isSaving}
								autoFocus
							/>
						</div>
					)}

					{!isDisable && (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
								<label htmlFor="new-app-pin" className="text-sm font-medium text-card-foreground">
									{isChange ? 'New PIN' : 'App PIN'}
								</label>
								<Input
									id="new-app-pin"
									type="password"
									inputMode="numeric"
									maxLength={4}
									autoComplete="off"
									placeholder="0000"
									value={pin}
									onChange={(event) => setPin(sanitizePin(event.target.value))}
									className="text-center font-mono text-lg tracking-[0.6em]"
									disabled={isSaving}
								/>
							</div>
							<div className="space-y-1.5">
								<label htmlFor="confirm-app-pin" className="text-sm font-medium text-card-foreground">
									Confirm PIN
								</label>
								<Input
									id="confirm-app-pin"
									type="password"
									inputMode="numeric"
									maxLength={4}
									autoComplete="off"
									placeholder="0000"
									value={confirmPin}
									onChange={(event) => setConfirmPin(sanitizePin(event.target.value))}
									className="text-center font-mono text-lg tracking-[0.6em]"
									disabled={isSaving}
								/>
							</div>
						</div>
					)}

					<div className="flex gap-2 border-t border-border pt-4">
						<Button
							type="submit"
							variant={isDisable ? 'destructive' : 'default'}
							className="flex-1"
							disabled={
								isSaving ||
								(isDisable
									? currentPin.length !== 4
									: pin.length !== 4 || confirmPin.length !== 4)
							}
						>
							{isSaving
								? 'Saving...'
								: isDisable
									? 'Disable PIN'
									: isChange
										? 'Change PIN'
										: 'Set PIN'}
						</Button>
						<Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
							Cancel
						</Button>
					</div>
				</form>
			</div>
		</div>
	)
}

export default function AppPinPanel() {
	const [status, setStatus] = useState({
		enabled: false,
		locked: false,
		locked_until: null,
		failed_attempts_remaining: null,
	})
	const [isLoadingStatus, setIsLoadingStatus] = useState(true)
	const [modalMode, setModalMode] = useState(null)
	const [success, setSuccess] = useState('')
	const [error, setError] = useState('')

	const loadStatus = useCallback(async () => {
		setIsLoadingStatus(true)
		setError('')
		try {
			setStatus(await getAppPinStatus())
		} catch (err) {
			setError(getApiErrorMessage(err, 'Could not load app PIN settings.'))
		} finally {
			setIsLoadingStatus(false)
		}
	}, [])

	useEffect(() => {
		loadStatus()
	}, [loadStatus])

	function handleSaved(nextStatus) {
		setStatus(nextStatus)
		setModalMode(null)
		setError('')
		setSuccess(
			modalMode === 'disable'
				? 'App PIN disabled. Payments can be sent without PIN until you set it again.'
				: status.enabled
					? 'App PIN changed.'
					: 'App PIN is ready for payment confirmation.',
		)
	}

	const enabled = status.enabled
	const lockedUntil = formatLockedUntil(status.locked_until)

	return (
		<>
			{modalMode && (
				<PinModal
					mode={modalMode}
					onClose={() => setModalMode(null)}
					onSaved={handleSaved}
				/>
			)}
			<FormBanner variant="success" message={success} />
			<FormBanner variant="error" message={error} />

			<VerificationMethodRow
				label="App PIN"
				active={enabled}
				hint={
					status.locked
						? `Too many failed attempts. Try again${lockedUntil ? ` after ${lockedUntil}` : ' later'}.`
						: enabled
							? `A 4-digit PIN can approve payments. ${status.failed_attempts_remaining ?? 5} attempt(s) remaining before lockout.`
							: 'Set a 4-digit PIN to approve payments. Requires your current password for first-time setup.'
				}
				action={
					<div className="flex w-full flex-col gap-2 sm:w-auto">
						<Button
							variant={enabled ? 'outline' : 'default'}
							className="w-full sm:w-auto"
							onClick={() => {
								setSuccess('')
								setError('')
								setModalMode(enabled ? 'change' : 'set')
							}}
							disabled={isLoadingStatus || status.locked}
						>
							{enabled ? 'Change PIN' : 'Set PIN'}
						</Button>
						{enabled && (
							<Button
								variant="outline"
								className="w-full sm:w-auto"
								onClick={() => {
									setSuccess('')
									setError('')
									setModalMode('disable')
								}}
								disabled={isLoadingStatus || status.locked}
							>
								Disable PIN
							</Button>
						)}
					</div>
				}
			/>
		</>
	)
}
