import api from '@/utils/api'
import {
	clearAuthSession,
	getAuthRememberPreference,
	setAuthUser,
	writeAuthTokens,
} from '@/utils/authStorage'

export async function register({ firstName, lastName, email, password }) {
	const { data } = await api.post('/auth/register', {
		first_name: firstName,
		last_name: lastName,
		email,
		password,
	})
	clearAuthSession()
	writeAuthTokens(data.data.access_token, data.data.refresh_token, { remember: true })
	setAuthUser(data.data.user, { remember: true })
	return data.data.user
}

export async function login({ email, password, remember = true }) {
	const { data } = await api.post('/auth/login', { email, password })
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

export async function disableBiometricAuthentication() {
	const { data } = await api.delete('/auth/biometrics')
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

export async function updateNotificationPreferences({ billingRemindersEnabled }) {
	const { data } = await api.patch('/auth/notification-preferences', {
		billing_reminders_enabled: billingRemindersEnabled,
	})
	const td = data.data
	if (td?.access_token && td?.refresh_token) {
		writeAuthTokens(td.access_token, td.refresh_token)
	}
	const user = td.user
	setAuthUser(user, { remember: getAuthRememberPreference() })
	return user
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

export async function requestPasswordReset({ email }) {
	const { data } = await api.post('/auth/password-reset/request', { email })
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
