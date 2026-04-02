import RegisterForm from '@/components/ui/register-form'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import loginAnimation from '@/assets/login-anim.lottie?url'
import { CreditCard, Send, Shield, Moon, Sun } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function RegisterPage() {

	// Theme state and persistence
	const [isDark, setIsDark] = useState(true)

	useEffect(() => {
		const savedTheme = localStorage.getItem('theme')
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
		const theme = savedTheme || (prefersDark ? 'dark' : 'light')
		
		setIsDark(theme === 'dark')
		document.documentElement.classList.toggle('dark', theme === 'dark')
		localStorage.setItem('theme', theme)
	}, [])

	const toggleTheme = () => {
		const newTheme = isDark ? 'light' : 'dark'
		setIsDark(!isDark)
		document.documentElement.classList.toggle('dark')
		localStorage.setItem('theme', newTheme)
	}
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

}
