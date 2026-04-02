import { ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import loginAnimation from '@/assets/login-anim.lottie?url'

const MOCK_USERS = {
	'talha.zlatar@symphony.is': 'password123'
}

export default function RegisterForm({ isDark = true }) {
	const navigate = useNavigate()
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [agreedToTerms, setAgreedToTerms] = useState(false)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const [success, setSuccess] = useState(false)
	const [passwordStrength, setPasswordStrength] = useState(0)

	useEffect(() => {
		if (success) {
			const timer = setTimeout(() => {
				navigate('/')
			}, 1000)
			return () => clearTimeout(timer)
		}
	}, [success, navigate])

	const calculatePasswordStrength = (pass) => {
		let strength = 0
		if (pass.length >= 8) strength++
		if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength++
		if (/[0-9]/.test(pass)) strength++
		if (/[^a-zA-Z0-9]/.test(pass)) strength++
		return strength
	}

