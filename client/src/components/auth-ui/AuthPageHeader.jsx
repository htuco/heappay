export default function AuthPageHeader({
	title,
	subtitle,
	icon,
	iconWrapperClassName = '',
	className = '',
}) {
	return (
		<div className={`space-y-3 text-center ${className}`}>
			<div
				className={`mx-auto grid h-12 w-12 place-items-center rounded-xl bg-linear-to-br from-primary to-secondary text-primary-foreground ${iconWrapperClassName}`}
			>
				{icon}
			</div>

			<h1 className="text-5xl font-semibold tracking-tight text-foreground">
				{title}
			</h1>

			{subtitle && (
				<p className="text-[16px] text-foreground/70">
					{subtitle}
				</p>
			)}
		</div>
	)
}