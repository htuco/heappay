export default function AuthButton({
	type = 'button',
	disabled = false,
	children,
	className = '',
	...props
}) {
	return (
		<button
			type={type}
			disabled={disabled}
			className={`h-14 w-full rounded-full bg-primary text-[20px] font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/40 disabled:opacity-70 disabled:hover:translate-y-0 ${className}`}
			{...props}
		>
			{children}
		</button>
	)
}