import logo from '@/assets/logo.png'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { loginSchema } from '@/schemas/loginSchema'
import { getApiErrorMessage } from '@/utils/api'
import AuthButton from '@/components/auth-ui/AuthButton'
import AuthCheckbox from '@/components/auth-ui/AuthCheckbox'
import AuthLinkLabel from '@/components/auth-ui/AuthLinkLabel'
import AuthPageHeader from '@/components/auth-ui/AuthPageHeader'
import AuthTextInput from '@/components/auth-ui/AuthTextInput'

const INITIAL_FORM_STATE = {
	email: '',
	password: '',
	rememberMe: false,
}

export default function LoginForm() {
	const navigate = useNavigate()
	const { login, isLoading: loading } = useAuth()
	const [form, setForm] = useState(INITIAL_FORM_STATE)
	const [error, setError] = useState('')
	const [errors, setErrors] = useState({})
	const [success, setSuccess] = useState(false)

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target
		setForm(prev => ({
			...prev,
			[name]: type === 'checkbox' ? checked : value,
		}))
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')
		setErrors({})

		const result = loginSchema.safeParse({
			email: form.email.trim(),
			password: form.password,
		})

		if (!result.success) {
			const fieldErrors = {}
			result.error.issues.forEach(err => {
				fieldErrors[err.path[0]] = err.message
			})
			setErrors(fieldErrors)
			return
		}

		try {
			await login({
				email: result.data.email,
				password: result.data.password,
				remember: form.rememberMe,
			})
			setSuccess(true)
			setForm(INITIAL_FORM_STATE)
			navigate('/dashboard', { replace: true })
		} catch (err) {
			setError(getApiErrorMessage(err, 'Invalid email or password'))
		}
	}
	return (
		<div className="flex items-center justify-center px-6 py-10 text-foreground min-h-screen">
			<div className="mx-auto w-full max-w-110 mt-5">
				<div className="space-y-6">
					<AuthPageHeader
						title="Welcome back"
						subtitle="Welcome back! Please enter your details."
						icon={<img src={logo} alt="Heap logo" className="h-9 w-auto" />}
						iconWrapperClassName="!bg-none !bg-transparent !text-foreground h-14 w-14"
					/>

					<form className="space-y-5" onSubmit={handleSubmit}>
						{error && (
							<div className="rounded-xl bg-red-950/30 border border-red-500/50 px-4 py-3 text-sm text-red-200">
								{error}
							</div>
						)}
						{success && (
							<div className="rounded-xl bg-green-950/30 border border-green-500/50 px-4 py-3 text-sm text-green-200">
								Login successful!
							</div>
						)}
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
								className="text-[15px] font-medium text-primary hover:underline"
							>
								Forgot password
							</button>
						</div>

						<AuthButton
							type="submit"
							disabled={loading}
						>
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
