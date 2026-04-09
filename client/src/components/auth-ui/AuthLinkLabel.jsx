export default function AuthLinkLabel({
	label,
	actionText,
	onAction,
	align = 'center',
	className = '',
}) {
	const alignmentClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'

	return (
		<p className={`pt-6 text-[17px] font-normal text-foreground/85 ${alignmentClass} ${className}`}>
			{label}{' '}
			<button
				type="button"
				onClick={onAction}
				style={{ color: 'var(--accent)' }}
				className="font-semibold hover:opacity-80 transition-opacity"
			>
				{actionText}
			</button>
		</p>
	)
}