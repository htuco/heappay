export const AUTH_TOKEN_KEY = 'heap.authToken'
export const AUTH_REFRESH_TOKEN_KEY = 'heap.authRefreshToken'
export const AUTH_USER_KEY = 'heap.authUser'

const LEGACY_SESSION_KEYS = [
	'authToken',
	'token',
	'accessToken',
	'refreshToken',
	'user',
]

const SESSION_KEYS = [AUTH_TOKEN_KEY, AUTH_REFRESH_TOKEN_KEY, AUTH_USER_KEY, ...LEGACY_SESSION_KEYS]

const getStoragePair = () => {
	if (typeof window === 'undefined') {
		return []
	}

	return [window.localStorage, window.sessionStorage]
}

export const getAuthToken = () => {
	for (const storage of getStoragePair()) {
		const token = storage.getItem(AUTH_TOKEN_KEY)

		if (token) {
			return token
		}
	}

	for (const storage of getStoragePair()) {
		for (const key of LEGACY_SESSION_KEYS) {
			const token = storage.getItem(key)

			if (token) {
				return token
			}
		}
	}

	return null
}

export const setAuthToken = (token, { remember = true } = {}) => {
	clearAuthSession()

	if (!token) {
		return
	}

	const storage = remember ? window.localStorage : window.sessionStorage
	storage.setItem(AUTH_TOKEN_KEY, token)
}

export const getAuthRefreshToken = () => {
	for (const storage of getStoragePair()) {
		const token = storage.getItem(AUTH_REFRESH_TOKEN_KEY)
		if (token) return token
	}
	return null
}

export const setAuthRefreshToken = (token, { remember = true } = {}) => {
	if (!token) return
	const storage = remember ? window.localStorage : window.sessionStorage
	storage.setItem(AUTH_REFRESH_TOKEN_KEY, token)
}

export const setAuthUser = (user, { remember = true } = {}) => {
	if (!user) {
		return
	}

	const storage = remember ? window.localStorage : window.sessionStorage
	storage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export const clearAuthSession = () => {
	for (const storage of getStoragePair()) {
		for (const key of SESSION_KEYS) {
			storage.removeItem(key)
		}
	}
}
