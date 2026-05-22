import { X } from 'lucide-react'

export default function AuthCloseButton({ to = '/' }) {
	return (
		<a
			href={to}
			className="absolute top-4 left-4 z-50 p-2 rounded-input bg-primary/20 hover:bg-primary/30 transition-colors"
			aria-label="Back to home"
		>
			<X className="h-5 w-5 text-foreground" />
		</a>
	)
}

