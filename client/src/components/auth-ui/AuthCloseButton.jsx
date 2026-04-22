import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function AuthCloseButton({ to = '/' }) {
	const navigate = useNavigate()

	return (
		<button
			onClick={() => navigate(to)}
			className="absolute top-4 left-4 z-50 p-2 rounded-lg bg-primary/20 hover:bg-primary/30 transition-colors"
			aria-label="Back to home"
			type="button"
		>
			<X className="h-5 w-5 text-foreground" />
		</button>
	)
}

