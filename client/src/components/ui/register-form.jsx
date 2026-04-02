import { ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import loginAnimation from '@/assets/login-anim.lottie?url'

const MOCK_USERS = {
	'talha.zlatar@symphony.is': 'password123'
}

export default function RegisterForm({ isDark = true }) {
