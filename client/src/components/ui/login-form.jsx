import BrandLogo from '@/components/ui/BrandLogo'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectUserStatuses } from '@/store/slices/referenceDataSlice'
import {
	clearTotpPending,
	selectAuthError,
	selectAuthStatus,
	selectTotpPartialToken,
	selectTotpRemember,
	verifyTotpLogin,
} from '@/store/slices/authSlice'
import { getStatusHomePath, resolveUserAccountStatus } from '@/utils/resolveUserAccountStatus'
import { loginSchema } from '@/schemas/loginSchema'
import { getApiErrorMessage } from '@/utils/api'
import AuthButton from '@/components/auth-ui/AuthButton'
import AuthCheckbox from '@/components/auth-ui/AuthCheckbox'
import AuthLinkLabel from '@/components/auth-ui/AuthLinkLabel'
import FormBanner from '@/components/ui/FormBanner'
import AuthPageHeader from '@/components/auth-ui/AuthPageHeader'
import AuthTextInput from '@/components/auth-ui/AuthTextInput'
import HCaptchaField from '@/components/auth-ui/HCaptchaField'
import { isHCaptchaEnabled } from '@/utils/hcaptcha'

const INITIAL_FORM_STATE = { email: '', password: '', rememberMe: false }

function TotpStep({ onBack }) {
	const dispatch = useAppDispatch()
	const navigate = useNavigate()
	const partialToken = useAppSelector(selectTotpPartialToken)
	const remember = useAppSelector(selectTotpRemember)
	const status = useAppSelector(selectAuthStatus)
	const reduxError = useAppSelector(selectAuthError)
	const userStatuses = useAppSelector(selectUserStatuses)
	const [code, setCode] = useState('')
	const [success, setSuccess] = useState(false)
	const loading = status === 'loading'

	const handleChange = (e) => {
		const val = e.target.value.replace(/\D/g, '').slice(0, 6)
		setCode(val)
		if (val.length === 6) submit(val)
	}

	const submit = async (value) => {
		const result = await dispatch(verifyTotpLogin({ partialToken, code: value, remember }))
		if (verifyTotpLogin.fulfilled.match(result)) {
			setSuccess(true)
			const user = result.payload
			const accountStatus = resolveUserAccountStatus(user?.status_id, userStatuses)
			setTimeout(() => navigate(getStatusHomePath(accountStatus), { replace: true }), 400)
		}
	}

	return (
		<div className="space-y-6">
			<AuthPageHeader
				title="Two-step verification"
				subtitle="Enter the 6-digit code from your authenticator app."
				icon={<BrandLogo className="h-10 w-auto" />}
				iconWrapperClassName="!bg-none !bg-transparent !text-foreground h-12 w-auto"
			/>

			<div className="space-y-5">
				<FormBanner variant="error" message={reduxError} />
				{success && <FormBanner variant="success" message="Verified! Signing you in..." />}

				<AuthTextInput
					autoFocus
					id="totp-code"
					name="totp-code"
					type="text"
					inputMode="numeric"
					label="Authentication code"
					placeholder="000000"
					value={code}
					onChange={handleChange}
					disabled={loading || success}
					maxLength={6}
				/>

				<AuthButton type="button" disabled={loading || success || code.length !== 6} onClick={() => submit(code)}>
					{loading ? 'Verifying...' : 'Verify'}
				</AuthButton>

				<button
					type="button"
					onClick={onBack}
					className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					Back to login
				</button>
			</div>
		</div>
	)
}

export default function LoginForm() {
	const navigate = useNavigate()
	const dispatch = useAppDispatch()
	const { login, isLoading: loading } = useAuth()
	const status = useAppSelector(selectAuthStatus)
	const userStatuses = useAppSelector(selectUserStatuses)
	const [form, setForm] = useState(INITIAL_FORM_STATE)
	const [error, setError] = useState('')
	const [errors, setErrors] = useState({})
	const [success, setSuccess] = useState(false)
	const [hcaptchaToken, setHcaptchaToken] = useState('')
	const captchaRef = useRef(null)

	const isTotpPending = status === 'totp_pending'

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target
		setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')
		setErrors({})

		const result = loginSchema.safeParse({ email: form.email.trim(), password: form.password })
		if (!result.success) {
			const fieldErrors = {}
			result.error.issues.forEach(err => { fieldErrors[err.path[0]] = err.message })
			setErrors(fieldErrors)
			return
		}
		if (isHCaptchaEnabled() && !hcaptchaToken) {
			setError('Please complete the security check and try again.')
			return
		}

		try {
			const user = await login({
				email: result.data.email,
				password: result.data.password,
				remember: form.rememberMe,
				hcaptchaToken,
			})
			if (user?.requiresTotp) return
			setSuccess(true)
			setForm(INITIAL_FORM_STATE)
			setHcaptchaToken('')
			const accountStatus = resolveUserAccountStatus(user?.status_id, userStatuses)
			setTimeout(() => navigate(getStatusHomePath(accountStatus), { replace: true }), 400)
		} catch (err) {
			setError(getApiErrorMessage(err, 'Invalid email or password.'))
			setHcaptchaToken('')
			captchaRef.current?.resetCaptcha()
		}
	}

	if (isTotpPending) {
		return (
			<div className="flex items-center justify-center px-4 py-8 text-foreground min-h-svh sm:px-6 sm:py-10">
				<div className="mx-auto w-full max-w-110 mt-5">
					<TotpStep onBack={() => dispatch(clearTotpPending())} />
				</div>
			</div>
		)
	}

	return (
		<div className="flex items-center justify-center px-4 py-8 text-foreground min-h-svh sm:px-6 sm:py-10">
			<div className="mx-auto w-full max-w-110 mt-5">
				<div className="space-y-6">
					<AuthPageHeader
						title="Welcome back"
						subtitle="Welcome back! Please enter your details."
						icon={<BrandLogo className="h-10 w-auto" />}
						iconWrapperClassName="!bg-none !bg-transparent !text-foreground h-12 w-auto"
					/>

					<form className="space-y-5" onSubmit={handleSubmit}>
						<FormBanner variant="error" message={error} />
						{success && <FormBanner variant="success" message="Login successful!" />}

						<AuthTextInput
							id="email"
							name="email"
							type="email"
							label="Enter your email"
							placeholder="E-mail"
							value={form.email}
							onChange={handleChange}
							disabled={loading}
							error={errors.email}
						/>

						<AuthTextInput
							id="password"
							name="password"
							type="password"
							label="Password"
							placeholder="Password"
							value={form.password}
							onChange={handleChange}
							disabled={loading}
							error={errors.password}
						/>

						<div className="flex items-center justify-between gap-4 pt-1 text-base">
							<AuthCheckbox
								name="rememberMe"
								checked={form.rememberMe}
								onChange={handleChange}
								disabled={loading}
								label="Remember me"
							/>
							<button
								type="button"
								onClick={() => navigate('/forgot-password')}
								className="inline-flex min-h-11 items-center text-sm font-medium text-primary touch-manipulation hover:underline md:min-h-0"
							>
								Forgot password
							</button>
						</div>

						<HCaptchaField
							captchaRef={captchaRef}
							disabled={loading}
							onVerify={setHcaptchaToken}
							onExpire={() => setHcaptchaToken('')}
							onError={() => {
								setHcaptchaToken('')
								setError('Security check failed to load. Please try again.')
							}}
						/>

						<AuthButton type="submit" disabled={loading}>
							{loading ? 'Logging in...' : 'Log in'}
						</AuthButton>
					</form>

					<AuthLinkLabel
						label="Don&apos;t have an account?"
						actionText="Sign up"
						onAction={() => navigate('/register')}
					/>
				</div>
			</div>
		</div>
	)
}
