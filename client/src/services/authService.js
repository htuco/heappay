import api from '@/utils/api'
import { clearAuthSession, setAuthUser, writeAuthTokens } from '@/utils/authStorage'

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
	writeAuthTokens(data.data.access_token, data.data.refresh_token, { remember })
	setAuthUser(data.data.user, { remember })
	return data.data.user
}

export async function getMe() {
	const { data } = await api.get('/auth/me')
	return data.data.user
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
