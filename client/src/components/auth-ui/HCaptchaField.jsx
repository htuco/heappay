import HCaptcha from '@hcaptcha/react-hcaptcha'

import { HCAPTCHA_SITE_KEY, isHCaptchaEnabled } from '@/utils/hcaptcha'

export default function HCaptchaField({
	captchaRef,
	onVerify,
	onExpire,
	onError,
	disabled = false,
}) {
	if (!isHCaptchaEnabled()) return null

	return (
		<div className={disabled ? 'pointer-events-none opacity-60' : ''}>
			<HCaptcha
				ref={captchaRef}
				sitekey={HCAPTCHA_SITE_KEY}
				onVerify={onVerify}
				onExpire={onExpire}
				onError={onError}
			/>
		</div>
	)
}
