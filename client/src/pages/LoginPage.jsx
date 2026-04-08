import LoginForm from '@/components/ui/login-form'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import loginAnimation from '@/assets/login-anim.lottie?url'
import { CreditCard, Send, Shield, Moon, Sun } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function LoginPage() {

	// Theme state and persistence TO:DO USE GLOBAL THEME SERVICE
	const [isDark, setIsDark] = useState(true)

	useEffect(() => {
		const savedTheme = localStorage.getItem('theme')
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
		const theme = savedTheme || (prefersDark ? 'dark' : 'light')
		
		setIsDark(theme === 'dark')
		document.documentElement.classList.toggle('dark', theme === 'dark')
	}, [])

	const toggleTheme = () => {
		const newTheme = isDark ? 'light' : 'dark'
		setIsDark(!isDark)
		document.documentElement.classList.toggle('dark')
		localStorage.setItem('theme', newTheme)
	}
	return (
		<section className="grid min-h-screen grid-cols-1 md:grid-cols-[65%_35%]">
			{/* Theme Switch Temp Button */}
			<button
				onClick={toggleTheme}
				className="absolute top-4 right-4 z-50 p-2 rounded-lg bg-primary/20 hover:bg-primary/30 transition-colors"
				aria-label="Toggle theme"
			>
				{isDark ? (
					<Sun className="h-5 w-5 text-foreground" />
				) : (
					<Moon className="h-5 w-5 text-foreground" />
				)}
			</button>

			<div>
			<LoginForm isDark={isDark} />		</div>
			<div className="relative overflow-hidden bg-gradient-to-br from-background to-background">
				<div
					className="absolute inset-0"
					style={{
						backgroundImage: isDark
							? 'linear-gradient(130deg, color-mix(in oklab, var(--accent) 74%, #000 26%), color-mix(in oklab, var(--accent) 88%, #000 12%), color-mix(in oklab, var(--accent) 68%, #000 32%))'
							: 'linear-gradient(130deg, color-mix(in oklab, var(--accent) 50%, #fff 50%), color-mix(in oklab, var(--accent) 60%, #fff 40%), color-mix(in oklab, var(--accent) 45%, #fff 55%))',
					}}
				/>
				<div className="absolute inset-0 z-10 bg-linear-to-b from-transparent via-transparent to-black/20 dark:to-black/20 to-white/10" />
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

				<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 text-center text-white dark:text-white md:px-6 xl:px-8">
					<div className="max-w-85">
						<div className="mb-6 md:mb-8 flex justify-center gap-4 md:gap-6">
							<div className={`flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full backdrop-blur-md border ${isDark ? 'bg-white/30 border-white/40' : 'bg-white/60 border-white/70'}`}>
								<CreditCard className={`h-5 w-5 md:h-6 md:w-6 ${isDark ? 'text-white' : 'text-accent'}`} />
							</div>
							<div className={`flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full backdrop-blur-md border ${isDark ? 'bg-white/30 border-white/40' : 'bg-white/60 border-white/70'}`}>
								<Send className={`h-5 w-5 md:h-6 md:w-6 ${isDark ? 'text-white' : 'text-accent'}`} />
							</div>
							<div className={`flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full backdrop-blur-md border ${isDark ? 'bg-white/30 border-white/40' : 'bg-white/60 border-white/70'}`}>
								<Shield className={`h-5 w-5 md:h-6 md:w-6 ${isDark ? 'text-white' : 'text-accent'}`} />
							</div>
						</div>
						<h2 className="text-2xl md:text-4xl leading-tight font-semibold tracking-tight text-white dark:text-white">
						"Your cards, finally connected."
						</h2>
						<p className="mx-auto mt-2 md:mt-4 text-sm md:text-[15px] leading-relaxed text-white/85 dark:text-white/85">
						Manage all your cards and track every transaction in one place, with clear insights that help you understand and control your spending.
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}
