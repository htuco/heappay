export default function LoginForm() {
	return (
		<section className="min-h-screen bg-border px-6 py-16 text-white">
			<div className="mx-auto w-full max-w-140">
				<div className="space-y-6">
					<form className="space-y-5" noValidate>
						<div>
							<label
								htmlFor="email"
								className="mb-2 block text-sm font-medium text-white/55"
							>
								Enter your email
							</label>
							<input
								id="email"
								type="email"
								placeholder="Name@marvilo.net"
								className="h-14 w-full rounded-2xl border bg-[#17181f] px-4 text-[17px] font-semibold text-white outline-none placeholder:text-white/90 focus-visible:border-accent"
								style={{ borderColor: 'var(--accent)' }}
							/>
						</div>

						<div>
							<label
								htmlFor="password"
								className="mb-2 block text-sm font-medium text-white/55"
							>
								Password
							</label>
							<input
								id="password"
								type="password"
								placeholder="Password"
								className="h-14 w-full rounded-2xl border border-transparent bg-[#17181f] px-4 text-[17px] font-semibold text-white outline-none placeholder:text-white/55"
							/>
						</div>

						<div className="flex items-center justify-between gap-4 pt-1 text-base">
							<label className="inline-flex items-center gap-3 text-[16px] font-semibold text-white/90">
								<input
									type="checkbox"
									className="h-6 w-6 appearance-none rounded-xl border border-border bg-transparent align-middle"
									style={{ borderColor: 'var(--border)' }}
								/>
								<span>Remember me</span>
							</label>
							<a href="#" className="text-[16px] font-semibold" style={{ color: 'var(--accent)' }}>
								Forgot password
							</a>
						</div>

						<button
							type="button"
							className="h-14 w-full rounded-full text-[20px] font-bold text-white"
							style={{
								backgroundImage:
									'linear-gradient(90deg, color-mix(in oklab, var(--accent) 90%, white 6%), color-mix(in oklab, var(--accent) 72%, white 18%))',
							}}
						>
							Log in
						</button>
					</form>

					<p className="pt-6 text-center text-[17px] font-semibold text-white/85">
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
