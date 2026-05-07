export default function AuthCheckbox({
	name,
	checked,
	onChange,
	label,
	disabled = false,
	className = '',
}) {
	return (
		<label className={`inline-flex items-center gap-3 text-sm font-normal text-foreground/90 cursor-pointer ${className}`}>
			<input
				type="checkbox"
				name={name}
				checked={checked}
				onChange={onChange}
				disabled={disabled}
				className="h-6 w-6 appearance-none rounded-xl border border-border bg-transparent align-middle cursor-pointer accent-accent checked:bg-accent disabled:opacity-60"
				style={{ borderColor: 'var(--border)' }}
			/>
			<span>{label}</span>
		</label>
	)
}