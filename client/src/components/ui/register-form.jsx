import { ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import loginAnimation from '@/assets/login-anim.lottie?url'
import { MOCK_USERS } from '@/lib/mocks'
import { registerSchema } from '@/lib/validation'

export default function RegisterForm({ isDark = true }) {
	const navigate = useNavigate()
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [agreedToTerms, setAgreedToTerms] = useState(false)
	const [error, setError] = useState('')
	const [errors, setErrors] = useState({})
	const [loading, setLoading] = useState(false)
	const [success, setSuccess] = useState(false)
	const [passwordStrength, setPasswordStrength] = useState(0)

	useEffect(() => {
		if (success) {
			const timer = setTimeout(() => {
				navigate('/')
			}, 1000)
			return () => clearTimeout(timer)
		}
	}, [success, navigate])

	const calculatePasswordStrength = (pass) => {
		let strength = 0
		if (pass.length >= 8) strength++
		if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength++
		if (/[0-9]/.test(pass)) strength++
		if (/[^a-zA-Z0-9]/.test(pass)) strength++
		return strength
	}

	useEffect(() => {
		setPasswordStrength(calculatePasswordStrength(password))
	}, [password])

	const handleInputFocus = (e) => {
		e.target.style.boxShadow = '0 0 0 2px var(--accent), 0 0 0 6px rgba(168, 85, 247, 0.15)'
		e.target.style.transitionDuration = '200ms'
	}

	const handleInputBlur = (e) => {
		e.target.style.boxShadow = 'none'
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')
		setErrors({})
		setLoading(true)

		// Validate with Zod
		const result = registerSchema.safeParse({
			firstName: firstName.trim(),
			lastName: lastName.trim(),
			email: email.trim(),
			password,
			confirmPassword,
		})

		if (!result.success) {
			const fieldErrors = {}
			result.error.issues.forEach(err => {
				fieldErrors[err.path[0]] = err.message
			})
			setErrors(fieldErrors)
			setLoading(false)
			return
		}

		if (!agreedToTerms) {
			setError('You must agree to the Terms of Service')
			return
		}

		setLoading(true)
		await new Promise(resolve => setTimeout(resolve, 500))

		if (MOCK_USERS[email.trim()]) {
			setError('Email already registered')
			setLoading(false)
			return
		}

		setSuccess(true)
		setFirstName('')
		setLastName('')
		setEmail('')
		setPassword('')
		setConfirmPassword('')
		setAgreedToTerms(false)
		setLoading(false)
	}

	const getPasswordStrengthColor = () => {
		if (passwordStrength === 0) return 'bg-gray-500'
		if (passwordStrength === 1) return 'bg-red-500'
		if (passwordStrength === 2) return 'bg-yellow-500'
		if (passwordStrength === 3) return 'bg-blue-500'
		return 'bg-green-500'
	}

	return (
		<section className="relative flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground md:bg-background">
			{/* Mobile Animation Background */}
			<div className="absolute inset-0 md:hidden overflow-hidden">
				<div
					className="absolute inset-0"
					style={{
						backgroundImage: isDark
							? 'linear-gradient(130deg, color-mix(in oklab, var(--accent) 74%, #000 26%), color-mix(in oklab, var(--accent) 88%, #000 12%), color-mix(in oklab, var(--accent) 68%, #000 32%))'
							: 'linear-gradient(130deg, color-mix(in oklab, var(--accent) 50%, #fff 50%), color-mix(in oklab, var(--accent) 60%, #fff 40%), color-mix(in oklab, var(--accent) 45%, #fff 55%))',
					}}
				/>
				<div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent dark:to-black/20 to-white/20" />
				<div className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden">
					<div className="w-full max-w-sm aspect-square">
						<DotLottieReact
							src={loginAnimation}
							autoplay
							loop
							speed={0.90}
							useFrameInterpolation={false}
							renderConfig={{ devicePixelRatio: 1 }}
							layout={{ fit: 'contain', align: [0.5, 0.5] }}
							className="h-full w-full"
						/>
					</div>
				</div>
			</div>

			<div className="mx-auto w-full max-w-110 relative z-10">
				<div className="space-y-6">
					<div className="space-y-3 text-center">
						<div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-linear-to-br from-primary to-secondary text-primary-foreground">
							<ShieldCheck className="h-6 w-6" strokeWidth={2.2} />
						</div>

						<h1 className="text-5xl font-semibold tracking-tight text-foreground">Create An Account</h1>
						<p className="text-[16px] text-foreground/70">Sign up to get started with your cards</p>
					</div>

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
							<div>
								<label htmlFor="firstName" className="mb-2 block text-sm font-bold text-foreground/55">
									First Name
								</label>
								<input
									id="firstName"
									type="text"
									placeholder="First name"
									value={firstName}
									onChange={(e) => setFirstName(e.target.value)}
									disabled={loading}
									className="h-14 w-full rounded-2xl border-none bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 disabled:opacity-50 transition-all duration-200"
									style={{ borderColor: 'var(--accent)' }}
									onFocus={handleInputFocus}
									onBlur={handleInputBlur}
								/>
								{errors.firstName && (
									<p className="mt-1 text-sm text-red-400">{errors.firstName}</p>
								)}
							</div>
							<div>
								<label htmlFor="lastName" className="mb-2 block text-sm font-bold text-foreground/55">
									Last Name
								</label>
								<input
									id="lastName"
									type="text"
									placeholder="Last name"
									value={lastName}
									onChange={(e) => setLastName(e.target.value)}
									disabled={loading}
									className="h-14 w-full rounded-2xl border-none bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 disabled:opacity-50 transition-all duration-200"
									style={{ borderColor: 'var(--accent)' }}
									onFocus={handleInputFocus}
									onBlur={handleInputBlur}
								/>
								{errors.lastName && (
									<p className="mt-1 text-sm text-red-400">{errors.lastName}</p>
								)}
							</div>
						</div>

						<div>
							<label htmlFor="email" className="mb-2 block text-sm font-bold text-foreground/55">
								Email Address
							</label>
							<input
								id="email"
								type="email"
								placeholder="Email address"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								disabled={loading}
								className="h-14 w-full rounded-2xl border-none bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 disabled:opacity-50 transition-all duration-200"
								style={{ borderColor: 'var(--accent)' }}
								onFocus={handleInputFocus}
								onBlur={handleInputBlur}
							/>
							{errors.email && (
								<p className="mt-1 text-sm text-red-400">{errors.email}</p>
							)}
						</div>

						<div>
							<label htmlFor="password" className="mb-2 block text-sm font-bold text-foreground/55">
								Password
							</label>
							<input
								id="password"
								type="password"
								placeholder="Minimum 8 characters"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={loading}
								className="h-14 w-full rounded-2xl border-none bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 disabled:opacity-50 transition-all duration-200"
								style={{ borderColor: 'var(--accent)' }}
								onFocus={handleInputFocus}
								onBlur={handleInputBlur}
							/>
							{errors.password && (
								<p className="mt-1 text-sm text-red-400">{errors.password}</p>
							)}
							{password && !errors.password && (
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

						<div>
							<label htmlFor="confirmPassword" className="mb-2 block text-sm font-bold text-foreground/55">
								Confirm Password
							</label>
							<input
								id="confirmPassword"
								type="password"
								placeholder="Repeat your password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								disabled={loading}
								className="h-14 w-full rounded-2xl border-none bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 disabled:opacity-50 transition-all duration-200"
								style={{ borderColor: 'var(--accent)' }}
								onFocus={handleInputFocus}
								onBlur={handleInputBlur}
							/>
							{errors.confirmPassword && (
								<p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
							)}
						</div>

						<label className="inline-flex items-center gap-3 text-[14px] font-normal text-foreground/90 cursor-pointer">
							<input
								type="checkbox"
								checked={agreedToTerms}
								onChange={(e) => setAgreedToTerms(e.target.checked)}
								disabled={loading}
								className="h-5 w-5 appearance-none rounded-lg border border-border bg-transparent align-middle cursor-pointer accent-accent checked:bg-accent"
								style={{ borderColor: 'var(--border)' }}
							/>
							<span>
								I agree to the{' '}
								<button
									type="button"
									onClick={() => navigate('/terms-of-service')}
									className="font-semibold hover:opacity-80 transition-opacity"
									style={{ color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
								>
									Terms of Service
								</button>
							</span>
						</label>

						<button
							type="submit"
							disabled={loading}
							className="h-14 w-full rounded-full text-[20px] font-bold text-primary-foreground disabled:opacity-70"
							style={{
								backgroundImage:
									'linear-gradient(90deg, color-mix(in oklab, var(--accent) 90%, white 6%), color-mix(in oklab, var(--accent) 72%, white 18%))',
							}}
						>
							{loading ? 'Creating Account...' : 'Sign Up'}
						</button>
					</form>

					<p className="pt-6 text-center text-[17px] font-normal text-foreground/85">
						Already have an account?{' '}
						<button
							type="button"
							onClick={() => navigate('/login')}
							style={{ color: 'var(--accent)' }}
							className="font-semibold hover:opacity-80 transition-opacity"
						>
							Log in
						</button>
					</p>
				</div>
			</div>
		</section>
	)
}
