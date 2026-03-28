import { ShieldCheck } from 'lucide-react'

export default function LoginForm() {
	const [rememberMe, setRememberMe] = useState(false)
	return (
		<section className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
			<div className="mx-auto w-full max-w-110">
				<div className="space-y-6">
					<div className="space-y-3 text-center">
						<div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-linear-to-br from-primary to-secondary text-primary-foreground">
							<ShieldCheck className="h-6 w-6" strokeWidth={2.2} />
						</div>

						<h1 className="text-5xl font-semibold tracking-tight text-foreground">Welcome back</h1>
						<p className="text-[16px] text-foreground/70">Welcome back! Please enter your details.</p>
					</div>

					<form className="space-y-5" noValidate>
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
								className="h-14 w-full rounded-2xl border bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 focus-visible:border-accent"
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
								className="h-14 w-full rounded-2xl border bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 focus-visible:border-accent"
                                style={{ borderColor: 'var(--accent)' }}
							/>
						</div>

						<div className="flex items-center justify-between gap-4 pt-1 text-base">
							<label className="inline-flex items-center gap-3 text-[15px] font-normal text-foreground/90">
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
							type="button"
							className="h-14 w-full rounded-full text-[20px] font-bold text-primary-foreground"
							style={{
								backgroundImage:
									'linear-gradient(90deg, color-mix(in oklab, var(--accent) 90%, white 6%), color-mix(in oklab, var(--accent) 72%, white 18%))',
							}}
						>
							Log in
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
