import axios from 'axios'
import { clearAuthSession, getAuthRefreshToken, getAuthToken, setAuthRefreshToken, setAuthToken } from './authStorage'

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

export const getApiErrorMessage = (error, fallback = 'Something went wrong') => {
	const data = error?.response?.data

	if (typeof data?.message === 'string') {
		return data.message
	}

	if (typeof data?.detail === 'string') {
		return data.detail
	}

	if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
		return data.detail[0].msg
	}

	if (typeof error?.message === 'string') {
		return error.message
	}

	return fallback
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

const responseInterceptor = api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config

		if (error?.response?.status === 401 && !originalRequest?._retry && !originalRequest?.skipAuthRedirect) {
			const refreshToken = getAuthRefreshToken()

			if (refreshToken) {
				originalRequest._retry = true

				if (!refreshPromise) {
					refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
						.then(({ data }) => {
							setAuthToken(data.data.access_token)
							setAuthRefreshToken(data.data.refresh_token)
							return data.data.access_token
						})
						.catch(() => {
							clearAuthSession()
							refreshPromise = null
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
	}
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
