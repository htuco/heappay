import LoginForm from '@/components/ui/login-form'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import loginAnimation from '@/assets/login-anim.lottie?url'
import { CreditCard, Send, Shield } from 'lucide-react'

export default function LoginPage() {
	return (
		<section className="grid min-h-screen grid-cols-1 md:grid-cols-[65%_35%]">
			<div>
				<LoginForm />
			</div>

			<div className="relative overflow-hidden">
				<div
					className="absolute inset-0"
					style={{
						backgroundImage:
							'linear-gradient(130deg, color-mix(in oklab, var(--accent) 74%, #fff 18%), color-mix(in oklab, var(--accent) 88%, #000 2%), color-mix(in oklab, var(--accent) 68%, #fff 26%))',
					}}
				/>
				<div className="absolute inset-0 z-10 bg-linear-to-b from-transparent via-transparent to-black/20" />
				<div className="relative z-10 flex h-full min-h-80 items-center justify-center p-4 md:p-6 xl:p-8">
					<div className="w-full max-w-xs md:max-w-none md:aspect-4/5">
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

				<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 text-center text-white md:px-6 xl:px-8">
					<div className="max-w-85">
						<div className="mb-6 md:mb-8 flex justify-center gap-4 md:gap-6">
							<div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-white/40 backdrop-blur-md border border-white/50">
								<CreditCard className="h-5 w-5 md:h-6 md:w-6" />
							</div>
							<div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-white/40 backdrop-blur-md border border-white/50">
								<Send className="h-5 w-5 md:h-6 md:w-6" />
							</div>
							<div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-white/40 backdrop-blur-md border border-white/50">
								<Shield className="h-5 w-5 md:h-6 md:w-6" />
							</div>
						</div>
						<h2 className="text-2xl md:text-4xl leading-tight font-semibold tracking-tight">
						"Your cards, finally connected."
						</h2>
						<p className="mx-auto mt-2 md:mt-4 text-sm md:text-[15px] leading-relaxed text-white/85">
						Manage all your cards and track every transaction in one place, with clear insights that help you understand and control your spending.
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}
