export const THEME_KEY = 'theme'

/** Returns the stored preference, defaulting to 'system' if absent or invalid. */
export const getStoredTheme = () => {
	const stored = localStorage.getItem(THEME_KEY)
	if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
	return 'system'
}

export const setStoredTheme = (value) => {
	localStorage.setItem(THEME_KEY, value)
}

/** Resolves a preference ('light' | 'dark' | 'system') to a boolean. */
export const resolveIsDark = (preference) => {
	if (preference === 'dark') return true
	if (preference === 'light') return false
	return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const applyTheme = (isDark) => {
	document.documentElement.classList.toggle('dark', isDark)
}
