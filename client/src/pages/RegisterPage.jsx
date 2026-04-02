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

}
