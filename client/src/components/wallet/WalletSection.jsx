export default function WalletSection({
	title,
	subtitle,
	icon,
	actions,
	headerClassName = '',
	className = '',
	children,
	as: Tag = 'section',
}) {
	const hasHeader = title || subtitle || icon || actions
	return (
		<Tag
			className={`rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6 ${className}`}
		>
			{hasHeader && (
				<header
					className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${headerClassName}`}
				>
					<div className="flex items-start gap-3 min-w-0">
						{icon && (
							<span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-linear-to-br from-primary/15 to-primary-light/15 text-primary">
								{icon}
							</span>
						)}
						<div className="min-w-0">
							{title && (
								<h2 className="text-lg font-semibold tracking-tight text-card-foreground sm:text-xl">
									{title}
								</h2>
							)}
							{subtitle && (
								<p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
							)}
						</div>
					</div>
					{actions && (
						<div className="flex flex-wrap items-center gap-2 sm:shrink-0">
							{actions}
						</div>
					)}
				</header>
			)}
			{children}
		</Tag>
	)
}
