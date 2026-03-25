import LoginForm from '@/components/ui/login-form'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import loginAnimation from '@/assets/login-anim.lottie?url'

export default function LoginPage() {
	return (
		<section className="grid min-h-screen grid-cols-1 lg:grid-cols-[70%_30%]">
		<section className="grid min-h-screen grid-cols-1 md:grid-cols-[65%_35%]">
			<div>
				<LoginForm />
			</div>

			<div className="relative hidden overflow-hidden lg:block">
				<div
					className="absolute inset-0"
					style={{
						backgroundImage:
							'linear-gradient(130deg, color-mix(in oklab, var(--accent) 74%, #fff 18%), color-mix(in oklab, var(--accent) 88%, #000 2%), color-mix(in oklab, var(--accent) 68%, #fff 26%))',
					}}
				/>
				<div className="relative z-10 flex h-full items-center justify-center p-6 xl:p-8">
					<div className="w-full max-w-105 aspect-4/5">
				<div className="relative z-10 flex h-full min-h-80 items-center justify-center p-4 md:p-6 xl:p-8">
					<div className="w-full max-w-xs md:max-w-none md:aspect-4/5">
						<DotLottieReact
							src={loginAnimation}
							autoplay
							loop
							speed={0.9}
							useFrameInterpolation={false}
							renderConfig={{ devicePixelRatio: 1 }}
							layout={{ fit: 'contain', align: [0.5, 0.5] }}
							className="h-full w-full"
						/>
					</div>
				</div>
			</div>
		</section>
	)
}
