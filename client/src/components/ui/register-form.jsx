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

	useEffect(() => {
		setPasswordStrength(calculatePasswordStrength(password))
	}, [password])

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')

		if (!firstName.trim() || !lastName.trim()) {
			setError('First name and last name are required')
			return
		}

		if (!email.trim().includes('@')) {
			setError('Please enter a valid email address')
			return
		}

		if (password.length < 8) {
			setError('Password must be at least 8 characters')
			return
		}

		if (password !== confirmPassword) {
			setError('Passwords do not match')
			return
		}

		if (!agreedToTerms) {
			setError('You must agree to the Terms of Service')
			return
		}

		setLoading(true)
		await new Promise(resolve => setTimeout(resolve, 500))

		if (MOCK_USERS[email.trim()]) {
			setError('Email already registered')
			setLoading(false)
			return
		}
