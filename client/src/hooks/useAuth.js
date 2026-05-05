import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
	hydrateSession,
	loginUser,
	logoutUser,
	registerUser,
	selectAuthError,
	selectAuthStatus,
	selectAuthUser,
} from '@/store/slices/authSlice'

export function useAuth() {
	const dispatch = useAppDispatch()
	const user = useAppSelector(selectAuthUser)
	const status = useAppSelector(selectAuthStatus)
	const error = useAppSelector(selectAuthError)
	const isLoading = status === 'loading'

	useEffect(() => {
		dispatch(hydrateSession())
	}, [dispatch])

	const login = useCallback(async ({ email, password, remember }) => {
		return dispatch(loginUser({ email, password, remember })).unwrap()
	}, [dispatch])

	const register = useCallback(async ({ firstName, lastName, email, password }) => {
		return dispatch(registerUser({ firstName, lastName, email, password })).unwrap()
	}, [dispatch])

	const logout = useCallback(() => dispatch(logoutUser()).unwrap(), [dispatch])

	return { user, isLoading, error, login, register, logout }
}
