export default function AuthLinkLabel({
	label,
	actionText,
	onAction,
	align = 'center',
	className = '',
}) {
	const alignmentClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'

	return (
		<p className={`pt-6 text-base font-normal text-foreground/85 ${alignmentClass} ${className}`}>
			{label}{' '}
			<button
				type="button"
				onClick={onAction}
				className="inline-flex min-h-11 items-center align-middle font-semibold text-primary touch-manipulation hover:underline md:min-h-0"
			>
				{actionText}
			</button>
		</p>
	)
}