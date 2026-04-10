export default function AuthTextInput({
	id,
	name,
	label,
	type = 'text',
	placeholder,
	value,
	onChange,
	disabled = false,
	error,
}) {
	return (
		<div>
			<label
				htmlFor={id}
				className="mb-2 block text-sm font-bold text-foreground/55"
			>
				{label}
			</label>

			<input
				id={id}
				name={name}
				type={type}
				placeholder={placeholder}
				value={value}
				onChange={onChange}
				disabled={disabled}
				className="h-14 w-full rounded-2xl border-none bg-input px-4 text-[15px] font-normal text-foreground outline-none placeholder:text-foreground/90 focus-visible:ring-2 focus-visible:ring-offset-0 disabled:opacity-50 transition-all duration-200"
				style={{
					borderColor: error ? '#ef4444' : 'var(--accent)',
					'--tw-ring-color': 'var(--accent)',
					'--tw-ring-offset-color': 'rgba(168, 85, 247, 0.15)',
				}}
			/>

			{error && (
				<p className="mt-1 text-sm text-red-400">
					{error}
				</p>
			)}
		</div>
	)
}