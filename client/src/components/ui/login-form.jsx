export default function LoginForm() {
	return (
		<section className="min-h-screen bg-[#09090c] px-6 py-14 text-white">
			<div className="mx-auto w-full max-w-[720px] rounded-[28px] bg-[#0f1016] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-10">
				<div className="mx-auto w-full max-w-[640px] space-y-7">
					<form className="space-y-6" noValidate>
						<div>
							<label
								htmlFor="email"
								className="mb-2 block text-sm font-semibold text-white/65"
							>
								Enter your email
							</label>
							<input
								id="email"
								type="email"
								placeholder="Name@marvilo.net"
								className="h-16 w-full rounded-2xl border border-[#7d42ff] bg-[#1b1c24] px-5 text-[2rem] font-semibold tracking-tight text-white outline-none placeholder:text-white/90"
							/>
						</div>

						<div>
							<label
								htmlFor="password"
								className="mb-2 block text-sm font-semibold text-white/65"
							>
								Password
							</label>
							<input
								id="password"
								type="password"
								placeholder="Password"
								className="h-16 w-full rounded-2xl border border-transparent bg-[#171820] px-5 text-[2rem] font-semibold tracking-tight text-white outline-none placeholder:text-white/55"
							/>
						</div>

						<div className="flex items-center justify-between gap-4 pt-1">
							<label className="inline-flex items-center gap-3 text-[2rem] font-semibold text-white/90">
								<input
									type="checkbox"
									className="h-9 w-9 appearance-none rounded-lg border border-white/40 bg-transparent"
								/>
								<span>Remember me</span>
							</label>
							<a href="#" className="text-[2rem] font-semibold text-[#a956ff]">
								Forgot password
							</a>
						</div>

						<button
							type="button"
							className="h-[72px] w-full rounded-full bg-gradient-to-r from-[#a34eff] to-[#8b5cff] text-[2.2rem] font-bold text-white shadow-[0_18px_45px_rgba(163,78,255,0.35)]"
						>
							Log in
						</button>
					</form>

					<p className="pt-4 text-center text-[1.9rem] font-semibold text-white/85">
						Don&apos;t have an account?{' '}
						<a href="#" className="text-[#a956ff]">
							Sign up
						</a>
					</p>
				</div>
			</div>
		</section>
	)
}
