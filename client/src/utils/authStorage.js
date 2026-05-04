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

/** Prefer session vs localStorage based on where tokens currently live */
export const getAuthRememberPreference = () => {
	if (typeof window === 'undefined') return true
	const inSession =
		window.sessionStorage.getItem(AUTH_REFRESH_TOKEN_KEY) ||
		window.sessionStorage.getItem(AUTH_TOKEN_KEY)
	if (inSession) return false
	return true
}

const stripAuthTokensBothStorages = () => {
	for (const storage of getStoragePair()) {
		storage.removeItem(AUTH_TOKEN_KEY)
		storage.removeItem(AUTH_REFRESH_TOKEN_KEY)
	}
}

/**
 * Writes access + refresh together without touching user blob.
 * Clears token keys from both storages then stores both in one place.
 */
export const writeAuthTokens = (accessToken, refreshToken, { remember = true } = {}) => {
	if (!accessToken || !refreshToken || typeof window === 'undefined') return

	const storage = remember ? window.localStorage : window.sessionStorage
	stripAuthTokensBothStorages()
	storage.setItem(AUTH_TOKEN_KEY, accessToken)
	storage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken)
}

/** After silent refresh: swap tokens only, keep user + remember preference */
export const swapAuthTokens = (accessToken, refreshToken) => {
	if (!accessToken || !refreshToken || typeof window === 'undefined') return
	writeAuthTokens(accessToken, refreshToken, {
		remember: getAuthRememberPreference(),
	})
}

/** Full reset then single access token — legacy; prefer clearAuthSession + writeAuthTokens */
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
