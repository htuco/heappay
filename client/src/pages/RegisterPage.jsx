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
}
