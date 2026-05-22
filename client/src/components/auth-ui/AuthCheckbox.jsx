export default function AuthCheckbox({
	name,
	checked,
	onChange,
	label,
	disabled = false,
	className = '',
}) {
	return (
		<label className={`inline-flex items-center gap-2 text-sm font-normal text-foreground/90 cursor-pointer ${className}`}>
			<span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
				<input
					type="checkbox"
					name={name}
					checked={checked}
					onChange={onChange}
					disabled={disabled}
					className="peer h-5 w-5 appearance-none rounded-chip border-2 border-border bg-transparent cursor-pointer transition-colors checked:border-accent checked:bg-accent disabled:opacity-60"
				/>
				<svg
					viewBox="0 0 16 16"
					fill="none"
					className="pointer-events-none absolute h-3.5 w-3.5 text-accent-foreground opacity-0 transition-opacity peer-checked:opacity-100"
					aria-hidden="true"
				>
					<path
						d="M3 8.5l3.2 3.2L13 5"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</span>
			<span>{label}</span>
		</label>
	)
}