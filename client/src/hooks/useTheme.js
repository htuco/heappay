import { useState, useEffect, useCallback } from 'react'
import { applyTheme, getStoredTheme, resolveIsDark, setStoredTheme } from '@/utils/theme'

/**
 * Single source of truth for theme across the app.
 *
 * preference: 'light' | 'dark' | 'system'  — what is stored in localStorage
 * isDark:     boolean                        — the resolved value applied to the DOM
 * setTheme:   (preference) => void           — set a specific preference
 * toggle:     () => void                     — flip between light and dark (clears system)
 */
export function useTheme() {
	const [preference, setPreference] = useState(getStoredTheme)
	const [isDark, setIsDark] = useState(() => resolveIsDark(getStoredTheme()))

	useEffect(() => {
		applyTheme(isDark)
	}, [isDark])

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
	}, [])

	const toggle = useCallback(() => {
		setTheme(isDark ? 'light' : 'dark')
	}, [isDark, setTheme])

	return { preference, isDark, setTheme, toggle }
}
