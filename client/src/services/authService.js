import api from '@/utils/api'
import { clearAuthSession, setAuthRefreshToken, setAuthToken, setAuthUser } from '@/utils/authStorage'

export async function register({ firstName, lastName, email, password }) {
	const { data } = await api.post('/auth/register', {
		first_name: firstName,
		last_name: lastName,
		email,
		password,
	})
	setAuthToken(data.data.access_token)
	setAuthRefreshToken(data.data.refresh_token)
	setAuthUser(data.data.user)
	return data.data.user
}

export async function login({ email, password, remember = true }) {
	const { data } = await api.post('/auth/login', { email, password })
	setAuthToken(data.data.access_token, { remember })
	setAuthRefreshToken(data.data.refresh_token, { remember })
	setAuthUser(data.data.user, { remember })
	return data.data.user
}

export async function getMe() {
	const { data } = await api.get('/auth/me')
	return data.data.user
}

export function logout() {
	clearAuthSession()
}
