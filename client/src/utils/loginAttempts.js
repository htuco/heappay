const STORAGE_PREFIX = 'heap:login-failures:'

function normalizeEmail(email) {
	return String(email ?? '').trim().toLowerCase()
}

function storageKey(email) {
	const normalized = normalizeEmail(email)
	return normalized ? `${STORAGE_PREFIX}${normalized}` : null
}

export function getLoginFailedAttempts(email) {
	const key = storageKey(email)
	if (!key) return 0
	const raw = sessionStorage.getItem(key)
	const parsed = Number.parseInt(raw ?? '', 10)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function syncLoginFailedAttempts(email, count) {
	const key = storageKey(email)
	if (!key) return
	if (!Number.isFinite(count) || count <= 0) {
		sessionStorage.removeItem(key)
		return
	}
	sessionStorage.setItem(key, String(count))
}

export function clearLoginFailures(email) {
	const key = storageKey(email)
	if (key) sessionStorage.removeItem(key)
}

export function isLoginCaptchaRequiredError(error) {
	if (error?.response?.data?.code === 'HCAPTCHA_REQUIRED') return true
	if (error?.code === 'HCAPTCHA_REQUIRED') return true

	const message = typeof error === 'string'
		? error
		: error?.message ?? error?.response?.data?.message

	return typeof message === 'string'
		&& message.toLowerCase().includes('security check')
}
