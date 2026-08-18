import { useCallback, useEffect, useState } from 'react'

import VerificationMethodRow from '@/components/settings/VerificationMethodRow'
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

			<VerificationMethodRow
				label="Face ID / fingerprint"
				active={enabled}
				hint={
					enabled
						? 'Approve payments with a biometric prompt on this device. Disabling verifies your biometrics first.'
						: 'Enroll this device to approve payments with Face ID or fingerprint. Password and PIN fallback stay available.'
				}
				action={
					<Button
						variant={enabled ? 'outline' : 'default'}
						className="w-full sm:w-auto"
						onClick={enabled ? handleDisable : handleEnable}
						disabled={isBusy}
					>
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
