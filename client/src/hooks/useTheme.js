import { useState, useEffect, useCallback } from 'react'
import { applyTheme, getStoredTheme, resolveIsDark, setStoredTheme, THEME_KEY } from '@/utils/theme'

const THEME_CHANGE_EVENT = 'heap:theme-change'

function readThemePreference() {
	return getStoredTheme()
}

/**
 * Single source of truth for theme across the app.
 *
 * preference: 'light' | 'dark' | 'system'  — what is stored in localStorage
 * isDark:     boolean                        — the resolved value applied to the DOM
 * setTheme:   (preference) => void           — set a specific preference
 * toggle:     () => void                     — flip between light and dark (clears system)
 */
export function useTheme() {
	const [preference, setPreference] = useState(readThemePreference)
	const [isDark, setIsDark] = useState(() => resolveIsDark(readThemePreference()))

	useEffect(() => {
		applyTheme(isDark)
	}, [isDark])

	useEffect(() => {
		function syncFromStorage() {
			const next = readThemePreference()
			setPreference(next)
			setIsDark(resolveIsDark(next))
		}

		function onStorage(event) {
			if (event.key === THEME_KEY || event.key === null) {
				syncFromStorage()
			}
		}

		window.addEventListener(THEME_CHANGE_EVENT, syncFromStorage)
		window.addEventListener('storage', onStorage)
		return () => {
			window.removeEventListener(THEME_CHANGE_EVENT, syncFromStorage)
			window.removeEventListener('storage', onStorage)
		}
	}, [])

	// When in System mode, track OS-level preference changes.
	useEffect(() => {
		if (preference !== 'system') return
		const mq = window.matchMedia('(prefers-color-scheme: dark)')
		const handler = (e) => setIsDark(e.matches)
		mq.addEventListener('change', handler)
		return () => mq.removeEventListener('change', handler)
	}, [preference])

	const setTheme = useCallback((value) => {
		setStoredTheme(value)
		setPreference(value)
		setIsDark(resolveIsDark(value))
		window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
	}, [])

	const toggle = useCallback(() => {
		setTheme(isDark ? 'light' : 'dark')
	}, [isDark, setTheme])

	return { preference, isDark, setTheme, toggle }
}
