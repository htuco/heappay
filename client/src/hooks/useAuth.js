import { useCallback, useEffect, useState } from 'react'
import * as authService from '@/services/authService'
import { getAuthRefreshToken, getAuthToken } from '@/utils/authStorage'

export function useAuth() {
	const [user, setUser] = useState(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		const token = getAuthToken()
		const refreshToken = getAuthRefreshToken()
		if (!token && !refreshToken) {
			setIsLoading(false)
			return
		}
		authService.getMe()
			.then(setUser)
			.catch(() => authService.logout())
			.finally(() => setIsLoading(false))
	}, [])

	const login = useCallback(async ({ email, password, remember }) => {
		setError(null)
		setIsLoading(true)
		try {
			const user = await authService.login({ email, password, remember })
			setUser(user)
			return user
		} catch (err) {
			setError(err?.response?.data?.message ?? 'Login failed.')
			throw err
		} finally {
			setIsLoading(false)
		}
	}, [])

	const register = useCallback(async ({ firstName, lastName, email, password }) => {
		setError(null)
		setIsLoading(true)
		try {
			const user = await authService.register({ firstName, lastName, email, password })
			setUser(user)
			return user
		} catch (err) {
			setError(err?.response?.data?.message ?? 'Registration failed.')
			throw err
		} finally {
			setIsLoading(false)
		}
	}, [])

	const logout = useCallback(() => {
		authService.logout()
		setUser(null)
	}, [])

	const isAdmin = user?.role_name === 'admin'
	const hasRole = (roleName) => user?.role_name === roleName

	return { user, isLoading, error, login, register, logout, isAdmin, hasRole }
}
