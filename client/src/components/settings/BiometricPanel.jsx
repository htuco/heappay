import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Fingerprint } from 'lucide-react'

import ActionRow from '@/components/settings/ActionRow'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import {
	beginBiometricDisable,
	beginBiometricRegistration,
	completeBiometricDisable,
	completeBiometricRegistration,
	getBiometricStatus,
} from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'
import {
	createBiometricCredential,
	getBiometricAssertion,
	isWebAuthnAssertionAvailable,
	isWebAuthnEnrollmentAvailable,
} from '@/utils/webauthn'

const UNSUPPORTED_MESSAGE =
	'Biometric authentication is not available on this device or browser.'

function getEnrollmentError(err) {
	if (err?.name === 'NotAllowedError') {
		return 'Biometric enrollment was cancelled or timed out. Try again when you are ready.'
	}

	return getApiErrorMessage(err, 'Could not enroll biometric authentication. Try again.')
}

export default function BiometricPanel() {
	const [status, setStatus] = useState({ enabled: false, credential_count: 0 })
	const [isLoadingStatus, setIsLoadingStatus] = useState(true)
	const [isEnrolling, setIsEnrolling] = useState(false)
	const [isDisabling, setIsDisabling] = useState(false)
	const [success, setSuccess] = useState('')
	const [error, setError] = useState('')

	const loadStatus = useCallback(async () => {
		setIsLoadingStatus(true)
		setError('')
		try {
			const response = await getBiometricStatus()
			setStatus(response)
		} catch (err) {
			setError(getApiErrorMessage(err, 'Could not load biometric settings.'))
		} finally {
			setIsLoadingStatus(false)
		}
	}, [])

	useEffect(() => {
		loadStatus()
	}, [loadStatus])

	async function handleEnable() {
		if (isEnrolling || status.enabled) return
		setSuccess('')
		setError('')

		if (!window.HeapNativeBiometrics?.registerCredential && !isWebAuthnEnrollmentAvailable()) {
			setError(UNSUPPORTED_MESSAGE)
			return
		}

		setIsEnrolling(true)
		try {
			const options = await beginBiometricRegistration()
			const credential = await createBiometricCredential(options.publicKey)
			const response = await completeBiometricRegistration({
				challengeId: options.challenge_id,
				credential,
			})
			setStatus({ enabled: true, credential_count: 1 })
			setSuccess(
				response?.device_type
					? 'Biometric authentication is enabled on this device.'
					: 'Biometric authentication is enabled.',
			)
		} catch (err) {
			setError(getEnrollmentError(err))
		} finally {
			setIsEnrolling(false)
		}
	}

	async function handleDisable() {
		if (isDisabling || !status.enabled) return
		setSuccess('')
		setError('')
		setIsDisabling(true)

		try {
		if (!window.HeapNativeBiometrics?.getAssertion && !isWebAuthnAssertionAvailable()) {
			throw new Error(UNSUPPORTED_MESSAGE)
		}
		const options = await beginBiometricDisable()
		const credential = await getBiometricAssertion(options.publicKey)
		const response = await completeBiometricDisable({
			challengeId: options.challenge_id,
			credential,
		})
			setStatus(response)
			setSuccess(
				'Biometric authentication is disabled. You can still use password, PIN, or authenticator fallback.',
			)
		} catch (err) {
		if (err?.name === 'NotAllowedError') {
			setError('Biometric verification was cancelled or timed out. Biometrics remain enabled.')
		} else {
			setError(getApiErrorMessage(err, 'Could not disable biometric authentication.'))
		}
		} finally {
			setIsDisabling(false)
		}
	}

	const enabled = status.enabled
	const isBusy = isLoadingStatus || isEnrolling || isDisabling

	return (
		<>
			<FormBanner variant="success" message={success} />
			<FormBanner variant="error" message={error} />

			<div className="rounded-surface border border-border bg-emphasis px-4 py-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex min-w-0 gap-3">
						<span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-input border ${enabled ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground'}`}>
							<Fingerprint className="h-4 w-4" />
						</span>
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-sm font-semibold text-card-foreground">Face ID / fingerprint</p>
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
									? 'Biometric approval is enabled. Disabling requires Face ID or fingerprint.'
									: 'Enroll this device now. Password, PIN, and authenticator fallback stay available.'}
							</p>
						</div>
					</div>
				</div>
			</div>

			<ActionRow
				label="Biometric authentication"
				hint={
					enabled
						? `${status.credential_count || 1} credential enrolled. Disabling verifies your biometrics first, then revokes server access.`
						: 'Use the secure biometric prompt on this device to enroll a passkey credential.'
				}
				action={
					<Button
						variant={enabled ? 'outline' : 'default'}
						className="w-full sm:w-auto"
						onClick={enabled ? handleDisable : handleEnable}
						disabled={isBusy}
					>
						<Fingerprint className="h-4 w-4" />
						{isEnrolling
							? 'Scanning...'
							: isDisabling
								? 'Disabling...'
								: enabled
									? 'Disable'
									: 'Enable'}
					</Button>
				}
			/>
		</>
	)
}
