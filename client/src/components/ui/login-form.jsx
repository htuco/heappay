import { ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import loginAnimation from '@/assets/login-anim.lottie?url'

const MOCK_USER = {
	email: 'talha.zlatar@symphony.is',
	password: 'password123'
}

export default function LoginForm({ isDark = true }) {
	const navigate = useNavigate()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [rememberMe, setRememberMe] = useState(false)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const [success, setSuccess] = useState(false)

	useEffect(() => {
		if (success) {
			const timer = setTimeout(() => {
				navigate('/')
			}, 1000)
			return () => clearTimeout(timer)
		}
	}, [success, navigate])

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')
		setLoading(true)

		// Simulate API delay
		await new Promise(resolve => setTimeout(resolve, 500))

		if (email.trim() === MOCK_USER.email && password === MOCK_USER.password) {
			setSuccess(true)
			setEmail('')
			setPassword('')
			console.log('Login successful', { email, rememberMe })
		} else {
			setError('Invalid email or password. Try: talha.zlatar@symphony.is / password123')
		}
		setLoading(false)
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
								type="email"
								placeholder="E-mail"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								disabled={loading}
								className="h-14 w-full rounded-2xl border bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 focus-visible:border-accent disabled:opacity-50"
								style={{ borderColor: 'var(--accent)' }}
							/>
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
								type="password"
								placeholder="Password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={loading}
								className="h-14 w-full rounded-2xl border bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 focus-visible:border-accent disabled:opacity-50"
                                style={{ borderColor: 'var(--accent)' }}
							/>
						</div>

						<div className="flex items-center justify-between gap-4 pt-1 text-base">
							<label className="inline-flex items-center gap-3 text-[15px] font-normal text-foreground/90 cursor-pointer">
								<input
									type="checkbox"
									checked={rememberMe}
									onChange={(e) => setRememberMe(e.target.checked)}
									className="h-6 w-6 appearance-none rounded-xl border border-border bg-transparent align-middle cursor-pointer accent-accent checked:bg-accent"
									style={{ borderColor: 'var(--border)' }}
								/>
								<span>Remember me</span>
							</label>
							<a href="#" className="text-[15px] font-normal" style={{ color: 'var(--accent)' }}>
								Forgot password
							</a>
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
						<a href="#" style={{ color: 'var(--accent)' }}>
							Sign up
						</a>
					</p>
				</div>
			</div>
		</section>
	)
}
