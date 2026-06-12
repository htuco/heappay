import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
	hydrateSession,
	loginUser,
	logoutUser,
	refreshSession,
	registerUser,
	selectAuthError,
	selectAuthStatus,
	selectAuthUser,
	updateProfileUser,
	uploadProfileAvatarUser,
} from '@/store/slices/authSlice'
import { getAuthRefreshToken, getAuthToken } from '@/utils/authStorage'

export function useAuth() {
	const dispatch = useAppDispatch()
	const user = useAppSelector(selectAuthUser)
	const status = useAppSelector(selectAuthStatus)
	const error = useAppSelector(selectAuthError)
	const isLoading = status === 'loading'

	useEffect(() => {
		dispatch(hydrateSession())
	}, [dispatch])

	useEffect(() => {
		const onFocus = () => {
			if (getAuthToken() || getAuthRefreshToken()) {
				dispatch(refreshSession())
			}
		}
		window.addEventListener('focus', onFocus)
		return () => window.removeEventListener('focus', onFocus)
	}, [dispatch])

	const login = useCallback(async ({ email, password, remember }) => {
		return dispatch(loginUser({ email, password, remember })).unwrap()
	}, [dispatch])

	const register = useCallback(async ({ firstName, lastName, email, password }) => {
		return dispatch(registerUser({ firstName, lastName, email, password })).unwrap()
	}, [dispatch])

	const updateProfile = useCallback(async (fields) => {
		return dispatch(updateProfileUser(fields)).unwrap()
	}, [dispatch])

	const uploadProfileAvatar = useCallback(async (file) => {
		return dispatch(uploadProfileAvatarUser(file)).unwrap()
	}, [dispatch])

	const logout = useCallback(() => dispatch(logoutUser()).unwrap(), [dispatch])

	const isHydrated = status !== 'idle' && status !== 'loading'
	const isAuthenticated = status === 'authenticated'
	const isAdmin = user?.role_name === 'admin'
	const isSupport = user?.role_name === 'support'
	const isManager = user?.role_name === 'manager'
	const isStaff = isAdmin || isManager || isSupport
	const hasRole = (roleName) => user?.role_name === roleName

	return { user, isLoading, isHydrated, isAuthenticated, error, login, register, updateProfile, uploadProfileAvatar, logout, isAdmin, isSupport, isManager, isStaff, hasRole }
}
