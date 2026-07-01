import axios from 'axios'
import {
	clearAuthSession,
	getAuthRefreshToken,
	getAuthRememberPreference,
	getAuthToken,
	setAuthUser,
	swapAuthTokens,
} from './authStorage'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const API_CLIENT_KEY = '__heapApiClient'
const API_INTERCEPTORS_KEY = '__heapApiInterceptors'
const API_REDIRECT_KEY = '__heapApiRedirectingToLogin'

const createApiClient = () => axios.create({
	baseURL: API_BASE_URL,
	headers: {
		Accept: 'application/json',
	},
})

export const api = globalThis[API_CLIENT_KEY] ?? createApiClient()
globalThis[API_CLIENT_KEY] = api
api.defaults.baseURL = API_BASE_URL

const defaultUnauthorizedHandler = () => {
	clearAuthSession()

	if (typeof window === 'undefined') {
		return
	}

	window.dispatchEvent(new CustomEvent('heap:unauthorized'))

	if (window.location.pathname !== '/login' && !globalThis[API_REDIRECT_KEY]) {
		globalThis[API_REDIRECT_KEY] = true
		window.location.assign('/login')
	}
}

let unauthorizedHandler = defaultUnauthorizedHandler

export const setUnauthorizedHandler = (handler) => {
	unauthorizedHandler = handler
}

export const resetUnauthorizedHandler = () => {
	unauthorizedHandler = defaultUnauthorizedHandler
}

const AUTH_ERROR_MESSAGES = [
	{
		match: (value) =>
			value.includes('account with this email already exists') ||
			value.includes('email already exists') ||
			value.includes('email_not_available'),
		message: 'An account with this email already exists.',
	},
	{
		match: (value) => value.includes('invalid email or password'),
		message: 'Invalid email or password.',
	},
	{
		match: (value) => value.includes('current password is incorrect'),
		message: 'Current password is incorrect.',
	},
	{
		match: (value) => value.includes('password reset link is invalid or expired'),
		message: 'Password reset link is invalid or expired.',
	},
	{
		match: (value) => value.includes('could not send password reset email'),
		message: 'Could not send password reset email. Check the address and try again.',
	},
]

const mapApiErrorMessage = (message) => {
	if (typeof message !== 'string') {
		return ''
	}

	const trimmed = message.trim()
	if (!trimmed) {
		return ''
	}

	const lower = trimmed.toLowerCase()
	const mapped = AUTH_ERROR_MESSAGES.find(({ match }) => match(lower))
	return mapped?.message ?? trimmed
}

const getValidationMessage = (details) => {
	if (!Array.isArray(details)) {
		return ''
	}

	return details.find((detail) => typeof detail?.msg === 'string')?.msg ?? ''
}

export const getApiErrorMessage = (error, fallback = 'Something went wrong') => {
	if (typeof error === 'string' && error.trim()) {
		return mapApiErrorMessage(error)
	}

	const data = error?.response?.data
	const status = error?.response?.status
	const detailMessage = getValidationMessage(data?.details) || getValidationMessage(data?.detail)

	if (data?.code === 'VALIDATION_ERROR' && detailMessage) {
		return mapApiErrorMessage(detailMessage)
	}

	if (typeof data?.message === 'string') {
		return mapApiErrorMessage(data.message)
	}

	if (typeof data?.detail === 'string') {
		return mapApiErrorMessage(data.detail)
	}

	if (detailMessage) {
		return mapApiErrorMessage(detailMessage)
	}

	if (error?.request && !error?.response) {
		return 'We could not reach the server. Check your connection and try again.'
	}

	if (status >= 500) {
		return fallback
	}

	if (typeof error?.message === 'string') {
		return mapApiErrorMessage(error.message)
	}

	return fallback
}

export function getApiErrorPayload(error, fallback = 'Something went wrong') {
	if (error && typeof error === 'object' && !error.response && typeof error.message === 'string') {
		return {
			message: mapApiErrorMessage(error.message),
			code: error.code ?? null,
			details: error.details ?? null,
			status: error.status ?? null,
		}
	}

	const data = typeof error === 'object' ? error?.response?.data : null
	return {
		message: getApiErrorMessage(error, fallback),
		code: data?.code ?? null,
		details: data?.details ?? null,
		status: typeof error === 'object' ? error?.response?.status ?? null : null,
	}
}

const existingInterceptors = globalThis[API_INTERCEPTORS_KEY]

if (existingInterceptors) {
	api.interceptors.request.eject(existingInterceptors.request)
	api.interceptors.response.eject(existingInterceptors.response)
}

const requestInterceptor = api.interceptors.request.use((config) => {
	const token = getAuthToken()

	if (token) {
		if (config.headers?.set) {
			config.headers.set('Authorization', `Bearer ${token}`)
		} else {
			config.headers = {
				...config.headers,
				Authorization: `Bearer ${token}`,
			}
		}
	} else if (config.headers?.Authorization) {
		config.headers.delete?.('Authorization')
		delete config.headers.Authorization
	}

	return config
})

let refreshPromise = null

const isPublicAuthRequest = (config) => {
	const url = config?.url ?? ''
	return ['/auth/login', '/auth/register', '/auth/refresh'].some((segment) =>
		url.includes(segment),
	)
}

const responseInterceptor = api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config
		const status = error?.response?.status

		if (
			status === 401 &&
			originalRequest &&
			!originalRequest._retry &&
			!originalRequest.skipAuthRedirect &&
			!isPublicAuthRequest(originalRequest)
		) {
			const refreshToken = getAuthRefreshToken()

			if (refreshToken) {
				originalRequest._retry = true

				if (!refreshPromise) {
					refreshPromise = axios
						.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
						.then(({ data: body }) => {
							const td = body?.data
							if (!td?.access_token || !td?.refresh_token) {
								throw new Error('Invalid refresh response')
							}
							swapAuthTokens(td.access_token, td.refresh_token)
							if (td.user) {
								setAuthUser(td.user, { remember: getAuthRememberPreference() })
							}
							return td.access_token
						})
						.catch(() => {
							clearAuthSession()
							defaultUnauthorizedHandler()
							return null
						})
						.finally(() => {
							refreshPromise = null
						})
				}

				const newAccessToken = await refreshPromise

				if (newAccessToken) {
					originalRequest.headers = {
						...originalRequest.headers,
						Authorization: `Bearer ${newAccessToken}`,
					}
					return api(originalRequest)
				}
			} else {
				clearAuthSession()
				try {
					unauthorizedHandler(error)
				} catch {
					defaultUnauthorizedHandler()
				}
			}
		}

		return Promise.reject(error)
	},
)

globalThis[API_INTERCEPTORS_KEY] = {
	request: requestInterceptor,
	response: responseInterceptor,
}

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		api.interceptors.request.eject(requestInterceptor)
		api.interceptors.response.eject(responseInterceptor)
		globalThis[API_INTERCEPTORS_KEY] = null
	})
}

export default api
