import api from '@/utils/api'
import {
	clearAuthSession,
	getAuthRememberPreference,
	setAuthUser,
	writeAuthTokens,
} from '@/utils/authStorage'

export async function register({ firstName, lastName, email, password, hcaptchaToken }) {
	const { data } = await api.post('/auth/register', {
		first_name: firstName,
		last_name: lastName,
		email,
		password,
		hcaptcha_token: hcaptchaToken,
	})
	clearAuthSession()
	writeAuthTokens(data.data.access_token, data.data.refresh_token, { remember: true })
	setAuthUser(data.data.user, { remember: true })
	return data.data.user
}

export async function login({ email, password, remember = true, hcaptchaToken }) {
	const { data } = await api.post('/auth/login', {
		email,
		password,
		hcaptcha_token: hcaptchaToken,
	})
	clearAuthSession()
	if (data.data?.requires_totp) {
		return { requiresTotp: true, partialToken: data.data.partial_token, remember }
	}
	writeAuthTokens(data.data.access_token, data.data.refresh_token, { remember })
	setAuthUser(data.data.user, { remember })
	return data.data.user
}

export async function verifyTotp({ partialToken, code, remember = true }) {
	const { data } = await api.post('/auth/totp/verify', {
		partial_token: partialToken,
		code,
	})
	writeAuthTokens(data.data.access_token, data.data.refresh_token, { remember })
	setAuthUser(data.data.user, { remember })
	return data.data.user
}

export async function setupTotp() {
	const { data } = await api.post('/auth/totp/setup')
	return data.data
}

export async function confirmTotp({ code }) {
	const { data } = await api.post('/auth/totp/confirm', { code })
	return data
}

export async function disableTotp({ code }) {
	const { data } = await api.delete('/auth/totp', { data: { code } })
	return data
}

export async function getBiometricStatus() {
	const { data } = await api.get('/auth/biometrics')
	return data
}

export async function beginBiometricRegistration() {
	const { data } = await api.post('/auth/biometrics/registration/options')
	return data
}

export async function completeBiometricRegistration({ challengeId, credential }) {
	const { data } = await api.post('/auth/biometrics/registration/complete', {
		challenge_id: challengeId,
		credential,
	})
	return data
}

export async function beginBiometricDisable() {
	const { data } = await api.post('/auth/biometrics/disable/options')
	return data
}

export async function completeBiometricDisable({ challengeId, credential }) {
	const { data } = await api.post('/auth/biometrics/disable/complete', {
		challenge_id: challengeId,
		credential,
	})
	return data
}

export async function getAppPinStatus() {
	const { data } = await api.get('/auth/app-pin')
	return data
}

export async function setAppPin({ currentPassword, pin }) {
	const { data } = await api.post('/auth/app-pin', {
		current_password: currentPassword,
		pin,
		confirm_pin: pin,
	})
	return data
}

export async function changeAppPin({ currentPin, newPin }) {
	const { data } = await api.patch('/auth/app-pin', {
		current_pin: currentPin,
		new_pin: newPin,
		confirm_pin: newPin,
	})
	return data
}

export async function disableAppPin({ currentPin }) {
	const { data } = await api.delete('/auth/app-pin', {
		data: { current_pin: currentPin },
	})
	return data
}

export async function getMe() {
	const { data } = await api.get('/auth/me')
	const user = data.data.user
	setAuthUser(user, { remember: getAuthRememberPreference() })
	return user
}

export async function updateProfile({ firstName, lastName, email, avatarUrl } = {}) {
	const payload = {}
	if (firstName !== undefined) payload.first_name = firstName
	if (lastName !== undefined) payload.last_name = lastName
	if (email !== undefined) payload.email = email
	if (avatarUrl !== undefined) payload.avatar_url = avatarUrl
	if (Object.keys(payload).length === 0) {
		throw new Error('No profile fields to update.')
	}
	const { data } = await api.patch('/auth/me', payload)
	const user = data.data.user
	setAuthUser(user, { remember: getAuthRememberPreference() })
	return user
}

export async function uploadProfileAvatar(file) {
	const formData = new FormData()
	formData.append('file', file)
	const { data } = await api.post('/auth/me/avatar', formData)
	const td = data.data
	if (td?.access_token && td?.refresh_token) {
		writeAuthTokens(td.access_token, td.refresh_token)
	}
	const user = td.user
	setAuthUser(user, { remember: getAuthRememberPreference() })
	return user
}

export async function updateNotificationPreferences({
	billingRemindersEnabled,
	emailPaymentSentEnabled,
	emailPaymentReceivedEnabled,
	emailTopupEnabled,
	emailRefundStatusEnabled,
}) {
	const { data } = await api.patch('/auth/notification-preferences', {
		billing_reminders_enabled: billingRemindersEnabled,
		email_payment_sent_enabled: emailPaymentSentEnabled,
		email_payment_received_enabled: emailPaymentReceivedEnabled,
		email_topup_enabled: emailTopupEnabled,
		email_refund_status_enabled: emailRefundStatusEnabled,
	})
	const td = data.data
	if (td?.access_token && td?.refresh_token) {
		writeAuthTokens(td.access_token, td.refresh_token)
	}
	const user = td.user
	setAuthUser(user, { remember: getAuthRememberPreference() })
	return user
}

export async function updatePaymentSecurityPreferences({
	paymentConfirmEnabled,
	paymentConfirmAboveAmount,
}) {
	const { data } = await api.patch('/auth/payment-security-preferences', {
		payment_confirm_enabled: paymentConfirmEnabled,
		payment_confirm_above_amount: paymentConfirmAboveAmount,
	})
	const td = data.data
	if (td?.access_token && td?.refresh_token) {
		writeAuthTokens(td.access_token, td.refresh_token)
	}
	const user = td.user
	setAuthUser(user, { remember: getAuthRememberPreference() })
	return user
}

export async function addRecoveryEmail({ email }) {
	const { data } = await api.post('/auth/recovery-email', { email })
	const td = data.data
	if (td?.access_token && td?.refresh_token) {
		writeAuthTokens(td.access_token, td.refresh_token)
	}
	if (td?.user) {
		setAuthUser(td.user, { remember: getAuthRememberPreference() })
	}
	return data
}

export async function changeRecoveryEmail({ email }) {
	const { data } = await api.patch('/auth/recovery-email', { email })
	const td = data.data
	if (td?.access_token && td?.refresh_token) {
		writeAuthTokens(td.access_token, td.refresh_token)
	}
	if (td?.user) {
		setAuthUser(td.user, { remember: getAuthRememberPreference() })
	}
	return data
}

export async function resendRecoveryEmailVerification() {
	const { data } = await api.post('/auth/recovery-email/resend')
	return data
}

export async function verifyRecoveryEmail({ token }) {
	const { data } = await api.post('/auth/recovery-email/verify', { token })
	return data
}

export async function removeRecoveryEmail({ password, totpCode }) {
	const payload = password ? { password } : { totp_code: totpCode }
	const { data } = await api.delete('/auth/recovery-email', { data: payload })
	const td = data.data
	if (td?.access_token && td?.refresh_token) {
		writeAuthTokens(td.access_token, td.refresh_token)
	}
	if (td?.user) {
		setAuthUser(td.user, { remember: getAuthRememberPreference() })
	}
	return data
}

export async function logout() {
	try {
		await api.post('/auth/logout')
	} catch {
		// Session cleanup must still happen even if server logout fails.
	} finally {
		clearAuthSession()
	}
}

export async function changePassword({ currentPassword, newPassword }) {
	const { data } = await api.post('/auth/change-password', {
		current_password: currentPassword,
		new_password: newPassword,
		confirm_password: newPassword,
	})
	return data
}

export async function requestPasswordReset({ email, hcaptchaToken }) {
	const { data } = await api.post('/auth/password-reset/request', {
		email,
		hcaptcha_token: hcaptchaToken,
	})
	return data
}

export async function confirmPasswordReset({ token, newPassword }) {
	const { data } = await api.post('/auth/password-reset/confirm', {
		token,
		new_password: newPassword,
		confirm_password: newPassword,
	})
	return data
}

/** Invited users: set password and move status to active (no current password). */
export async function acceptInvitation({ newPassword }) {
	const { data } = await api.post('/auth/accept-invitation', {
		new_password: newPassword,
		confirm_password: newPassword,
	})
	const td = data.data
	if (td?.access_token && td?.refresh_token) {
		writeAuthTokens(td.access_token, td.refresh_token, {
			remember: getAuthRememberPreference(),
		})
	}
	if (td?.user) {
		setAuthUser(td.user, { remember: getAuthRememberPreference() })
	}
	return td?.user
}

export async function deactivateAccount({ currentPassword }) {
	const { data } = await api.post('/auth/deactivate', {
		current_password: currentPassword,
	})
	return data
}
