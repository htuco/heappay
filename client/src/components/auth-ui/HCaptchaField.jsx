import HCaptcha from '@hcaptcha/react-hcaptcha'
import { ShieldCheck, X } from 'lucide-react'

import { HCAPTCHA_SITE_KEY, isHCaptchaEnabled } from '@/utils/hcaptcha'

export function HCaptchaModal({
	open,
	captchaRef,
	title = 'Security check',
	description = 'Complete the quick check so we can continue securely.',
	disabled = false,
	onVerify,
	onExpire,
	onError,
	onClose,
}) {
	if (!open || !isHCaptchaEnabled()) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 px-4 py-6 backdrop-blur-sm animate-in fade-in-0 duration-200">
			<div className="relative w-full max-w-[380px] overflow-hidden rounded-4xl border border-white/70 bg-background/95 p-6 text-center shadow-2xl shadow-primary/15 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-modal-spring">
				<button
					type="button"
					onClick={onClose}
					disabled={disabled}
					className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
					aria-label="Close security check"
				>
					<X className="h-4 w-4" />
				</button>

				<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
					<ShieldCheck className="h-7 w-7" />
				</div>

				<div className="mb-5 space-y-2">
					<h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
					<p className="mx-auto max-w-70 text-sm leading-6 text-muted-foreground">{description}</p>
				</div>

				<div className={disabled ? 'pointer-events-none opacity-60' : ''}>
					<div className="flex justify-center">
						<HCaptcha
							ref={captchaRef}
							sitekey={HCAPTCHA_SITE_KEY}
							theme="light"
							onVerify={onVerify}
							onExpire={onExpire}
							onError={onError}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
