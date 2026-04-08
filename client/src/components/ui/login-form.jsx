import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOCK_USERS } from '@/lib/mocks'
import { loginSchema } from '@/schemas/loginSchema'

const INITIAL_FORM_STATE = {
	email: '',
	password: '',
	rememberMe: false,
}

export default function LoginForm() {
	const navigate = useNavigate()
	const [form, setForm] = useState(INITIAL_FORM_STATE)
	const [error, setError] = useState('')
	const [errors, setErrors] = useState({})
	const [loading, setLoading] = useState(false)
	const [success, setSuccess] = useState(false)

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target
		setForm(prev => ({
			...prev,
			[name]: type === 'checkbox' ? checked : value,
		}))
	}

	const resetForm = () => setForm(INITIAL_FORM_STATE)

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')
		setErrors({})
		setLoading(true)

		// Validate with Zod
		const result = loginSchema.safeParse({
			email: form.email.trim(),
			password: form.password
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

		// Simulate API delay
		await new Promise(resolve => setTimeout(resolve, 500))

		const user = MOCK_USERS.find(u => u.email === form.email.trim() && u.password === form.password)

		if (user) {
			setSuccess(true)
			resetForm()
			setLoading(false)

			setTimeout(() => {
				navigate('/')
			}, 1000)
		} else {
			setError('Invalid email or password. Try: talha.zlatar@symphony.is / password123')
			setLoading(false)
		}
	}
	return (
		<div className="flex items-center justify-center px-6 py-10 text-foreground min-h-screen">
			<div className="mx-auto w-full max-w-110 mt-5">
				<div className="space-y-6">
					<div className="space-y-3 text-center">
						<div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-linear-to-br from-primary to-secondary text-primary-foreground">
							<ShieldCheck className="h-6 w-6" strokeWidth={2.2} />
						</div>

						<h1 className="text-5xl font-semibold tracking-tight text-foreground">Welcome back</h1>
						<p className="text-[16px] text-foreground/70">Welcome back! Please enter your details.</p>
					</div>

					<form className="space-y-5" onSubmit={handleSubmit}>
						{error && (
							<div className="rounded-xl bg-red-950/30 border border-red-500/50 px-4 py-3 text-sm text-red-200">
								{error}
							</div>
						)}
						{success && (
							<div className="rounded-xl bg-green-950/30 border border-green-500/50 px-4 py-3 text-sm text-green-200">
								✓ Login successful!
							</div>
						)}
						<div>
							<label
								htmlFor="email"
								className="mb-2 block text-sm font-bold text-foreground/55"
							>
								Enter your email
							</label>
							<input
								id="email"
								name="email"
								type="email"
								placeholder="E-mail"
								value={form.email}
								onChange={handleChange}
								disabled={loading}
								className="h-14 w-full rounded-2xl border-none bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 focus-visible:ring-2 focus-visible:ring-offset-0 disabled:opacity-50 transition-all duration-200"
								style={{ 
									borderColor: errors.email ? '#ef4444' : 'var(--accent)',
									'--tw-ring-color': 'var(--accent)',
									'--tw-ring-offset-color': 'rgba(168, 85, 247, 0.15)'
								}}
							/>
							{errors.email && (
								<p className="mt-1 text-sm text-red-400">{errors.email}</p>
							)}
						</div>

						<div>
							<label
								htmlFor="password"
								className="mb-2 block text-sm font-bold text-foreground/55"
							>
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								placeholder="Password"
								value={form.password}
								onChange={handleChange}
								disabled={loading}
								className="h-14 w-full rounded-2xl border-none bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 focus-visible:ring-2 focus-visible:ring-offset-0 disabled:opacity-50 transition-all duration-200"
								style={{ 
									borderColor: errors.password ? '#ef4444' : 'var(--accent)',
									'--tw-ring-color': 'var(--accent)',
									'--tw-ring-offset-color': 'rgba(168, 85, 247, 0.15)'
								}}
							/>
							{errors.password && (
								<p className="mt-1 text-sm text-red-400">{errors.password}</p>
							)}
						</div>

						<div className="flex items-center justify-between gap-4 pt-1 text-base">
							<label className="inline-flex items-center gap-3 text-[15px] font-normal text-foreground/90 cursor-pointer">
								<input
									type="checkbox"
									name="rememberMe"
									checked={form.rememberMe}
									onChange={handleChange}
									className="h-6 w-6 appearance-none rounded-xl border border-border bg-transparent align-middle cursor-pointer accent-accent checked:bg-accent"
									style={{ borderColor: 'var(--border)' }}
								/>
								<span>Remember me</span>
							</label>
							<button 
								type="button"
								onClick={() => navigate('/forgot-password')}
								className="text-[15px] font-normal" 
								style={{ color: 'var(--accent)' }}
							>
								Forgot password
							</button>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="h-14 w-full rounded-full text-[20px] font-bold text-primary-foreground disabled:opacity-70"
							style={{
								backgroundImage:
									'linear-gradient(90deg, color-mix(in oklab, var(--accent) 90%, white 6%), color-mix(in oklab, var(--accent) 72%, white 18%))',
							}}
							>
							{loading ? 'Logging in...' : 'Log in'}
						</button>
					</form>

					<p className="pt-6 text-center text-[17px] font-normal text-foreground/85">
						Don&apos;t have an account?{' '}
						<button
							type="button"
							onClick={() => navigate('/register')}
							style={{ color: 'var(--accent)' }}
							className="font-semibold hover:opacity-80 transition-opacity"
						>
							Sign up
						</button>
					</p>
				</div>
			</div>
		</div>
	)
}
