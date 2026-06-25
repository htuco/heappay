import BrandLogo from '@/components/ui/BrandLogo'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerSchema } from '@/schemas/registerSchema'
import { useAuth } from '@/hooks/useAuth'
import AuthButton from '@/components/auth-ui/AuthButton'
import AuthCheckbox from '@/components/auth-ui/AuthCheckbox'
import AuthLinkLabel from '@/components/auth-ui/AuthLinkLabel'
import FormBanner from '@/components/ui/FormBanner'
import AuthPageHeader from '@/components/auth-ui/AuthPageHeader'
import AuthTextInput from '@/components/auth-ui/AuthTextInput'
import { getApiErrorMessage } from '@/utils/api'

const INITIAL_FORM_STATE = {
	firstName: '',
	lastName: '',
	email: '',
	password: '',
	confirmPassword: '',
	agreedToTerms: false,
}

const isDuplicateEmailMessage = (message) =>
	message.toLowerCase().includes('account with this email already exists')

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
			const message = getApiErrorMessage(err, 'Could not create your account. Please try again.')
			setError(message)
			if (isDuplicateEmailMessage(message)) {
				setErrors({ email: 'Use a different email or try logging in.' })
			}
		}
	}

	const getPasswordStrengthColor = () => {
		if (passwordStrength === 0) return 'bg-muted-foreground'
		if (passwordStrength === 1) return 'bg-destructive'
		if (passwordStrength === 2) return 'bg-warning'
		if (passwordStrength === 3) return 'bg-info'
		return 'bg-success'
	}

	return (
		<div className="flex items-center justify-center px-4 py-8 text-foreground min-h-svh sm:px-6 sm:py-10">
			<div className="mx-auto w-full max-w-110 mt-5">
				<div className="space-y-6">
					<AuthPageHeader
						title="Create An Account"
						subtitle="Sign up to get started with your cards"
						icon={<BrandLogo className="h-10 w-auto" />}
						iconWrapperClassName="!bg-none !bg-transparent !text-foreground h-12 w-auto"
					/>

					<form className="space-y-5" onSubmit={handleSubmit}>
						<FormBanner variant="error" message={error} />
						{success && (
							<FormBanner variant="success" message="Account created successfully!" />
						)}

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
										title="Coming soon"
										className="font-semibold text-primary hover:underline"
										style={{ background: 'none', border: 'none', padding: 0, cursor: 'default' }}
									>
										Terms of Service
									</button>
								</span>
							)}
							className="text-sm"
						/>
						{errors.agreedToTerms && (
							<p className="mt-1 text-sm text-destructive">{errors.agreedToTerms}</p>
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
