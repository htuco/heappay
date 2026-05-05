import { ShieldCheck } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerSchema } from '@/schemas/registerSchema'
import { useAuth } from '@/hooks/useAuth'
import AuthButton from '@/components/auth-ui/AuthButton'
import AuthCheckbox from '@/components/auth-ui/AuthCheckbox'
import AuthLinkLabel from '@/components/auth-ui/AuthLinkLabel'
import AuthPageHeader from '@/components/auth-ui/AuthPageHeader'
import AuthTextInput from '@/components/auth-ui/AuthTextInput'

const INITIAL_FORM_STATE = {
	firstName: '',
	lastName: '',
	email: '',
	password: '',
	confirmPassword: '',
	agreedToTerms: false,
}

export default function RegisterForm() {
	const navigate = useNavigate()
	const { register, isLoading: loading } = useAuth()
	const [form, setForm] = useState(INITIAL_FORM_STATE)
	const [error, setError] = useState('')
	const [errors, setErrors] = useState({})
	const [success, setSuccess] = useState(false)

	const calculatePasswordStrength = (pass) => {
		let strength = 0
		if (pass.length >= 8) strength++
		if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength++
		if (/[0-9]/.test(pass)) strength++
		if (/[^a-zA-Z0-9]/.test(pass)) strength++
		return strength
	}

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target
		setForm(prev => ({
			...prev,
			[name]: type === 'checkbox' ? checked : value,
		}))
	}

	const passwordStrength = useMemo(
		() => calculatePasswordStrength(form.password),
		[form.password]
	)

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')
		setErrors({})

		const result = registerSchema.safeParse({
			firstName: form.firstName.trim(),
			lastName: form.lastName.trim(),
			email: form.email.trim(),
			password: form.password,
			confirmPassword: form.confirmPassword,
			agreedToTerms: form.agreedToTerms,
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
			await register({
				firstName: form.firstName.trim(),
				lastName: form.lastName.trim(),
				email: form.email.trim(),
				password: form.password,
			})
			setSuccess(true)
			setForm(INITIAL_FORM_STATE)
			setTimeout(() => navigate('/dashboard'), 1000)
		} catch (err) {
			setError(err?.response?.data?.message ?? 'Registration failed.')
		}
	}

	const getPasswordStrengthColor = () => {
		if (passwordStrength === 0) return 'bg-gray-500'
		if (passwordStrength === 1) return 'bg-red-500'
		if (passwordStrength === 2) return 'bg-yellow-500'
		if (passwordStrength === 3) return 'bg-blue-500'
		return 'bg-green-500'
	}

	return (
		<div className="flex items-center justify-center px-6 py-10 text-foreground min-h-screen">
			<div className="mx-auto w-full max-w-110 mt-5">
				<div className="space-y-6">
					<AuthPageHeader
						title="Create An Account"
						subtitle="Sign up to get started with your cards"
						icon={<ShieldCheck className="h-6 w-6" strokeWidth={2.2} />}
					/>

					<form className="space-y-5" onSubmit={handleSubmit}>
						{error && (
							<div className="rounded-xl bg-red-950/30 border border-red-500/50 px-4 py-3 text-sm text-red-200">
								{error}
							</div>
						)}
						{success && (
							<div className="rounded-xl bg-green-950/30 border border-green-500/50 px-4 py-3 text-sm text-green-200">
								Account created successfully!
							</div>
						)}

						<div className="grid grid-cols-2 gap-4">
							<AuthTextInput
								id="firstName"
								name="firstName"
								type="text"
								label="First Name"
								placeholder="First name"
								value={form.firstName}
								onChange={handleChange}
								disabled={loading}
								error={errors.firstName}
							/>
							<AuthTextInput
								id="lastName"
								name="lastName"
								type="text"
								label="Last Name"
								placeholder="Last name"
								value={form.lastName}
								onChange={handleChange}
								disabled={loading}
								error={errors.lastName}
							/>
						</div>

						<AuthTextInput
							id="email"
							name="email"
							type="email"
							label="Email Address"
							placeholder="Email address"
							value={form.email}
							onChange={handleChange}
							disabled={loading}
							error={errors.email}
						/>

						<div>
							<AuthTextInput
								id="password"
								name="password"
								type="password"
								label="Password"
								placeholder="Minimum 8 characters"
								value={form.password}
								onChange={handleChange}
								disabled={loading}
								error={errors.password}
							/>
							{form.password && !errors.password && (
								<div className="mt-2 flex gap-1">
									{[...Array(4)].map((_, i) => (
										<div
											key={i}
											className={`h-1 flex-1 rounded-full ${
												i < passwordStrength ? getPasswordStrengthColor() : 'bg-foreground/20'
											}`}
										/>
									))}
								</div>
							)}
						</div>

						<AuthTextInput
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							label="Confirm Password"
							placeholder="Repeat your password"
							value={form.confirmPassword}
							onChange={handleChange}
							disabled={loading}
							error={errors.confirmPassword}
						/>

						<AuthCheckbox
							name="agreedToTerms"
							checked={form.agreedToTerms}
							onChange={handleChange}
							disabled={loading}
							label={(
								<span>
									I agree to the{' '}
									<button
										type="button"
										onClick={() => navigate('/terms-of-service')}
										className="font-semibold text-primary hover:underline"
										style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
									>
										Terms of Service
									</button>
								</span>
							)}
							className="text-[14px]"
						/>
						{errors.agreedToTerms && (
							<p className="mt-1 text-sm text-red-400">{errors.agreedToTerms}</p>
						)}

						<AuthButton
							type="submit"
							disabled={loading}
						>
							{loading ? 'Creating Account...' : 'Sign Up'}
						</AuthButton>
					</form>

					<AuthLinkLabel
						label="Already have an account?"
						actionText="Log in"
						onAction={() => navigate('/login')}
					/>
				</div>
			</div>
		</div>
	)
}
