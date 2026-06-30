export const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY ?? ''

export function isHCaptchaEnabled() {
	return Boolean(HCAPTCHA_SITE_KEY)
}
