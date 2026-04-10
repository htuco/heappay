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
			className={`h-14 w-full rounded-full text-[20px] font-bold text-primary-foreground disabled:opacity-70 ${className}`}
			style={{
				backgroundImage:
					'linear-gradient(90deg, color-mix(in oklab, var(--accent) 90%, white 6%), color-mix(in oklab, var(--accent) 72%, white 18%))',
			}}
			{...props}
		>
			{children}
		</button>
	)
}