import { X } from 'lucide-react'

export default function AuthCloseButton({ to = '/' }) {
	return (
		<a
			href={to}
			className="absolute top-[max(1rem,env(safe-area-inset-top,0px))] left-[max(1rem,env(safe-area-inset-left,0px))] z-50 flex h-11 w-11 items-center justify-center rounded-input bg-primary/20 hover:bg-primary/30 transition-colors touch-manipulation"
			aria-label="Back to home"
		>
			<X className="h-5 w-5 text-foreground" />
		</a>
	)
}

