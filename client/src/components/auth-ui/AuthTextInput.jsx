import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

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
	const isPassword = type === 'password'
	const [revealed, setRevealed] = useState(false)
	const effectiveType = isPassword && revealed ? 'text' : type

	return (
		<div>
			<label
				htmlFor={id}
				className="mb-2 block text-sm font-bold text-foreground/55"
			>
				{label}
			</label>

			<div className="relative">
				<input
					id={id}
					name={name}
					type={effectiveType}
					placeholder={placeholder}
					value={value}
					onChange={onChange}
					disabled={disabled}
					className={`h-14 w-full rounded-input border-2 bg-input text-sm font-normal text-foreground outline-none placeholder:text-foreground/90 focus-visible:ring-2 focus-visible:ring-offset-0 disabled:opacity-50 transition-all duration-200 ${isPassword ? 'pl-4 pr-12' : 'px-4'}`}
					style={{
						borderColor: error ? 'var(--destructive)' : 'var(--accent)',
						'--tw-ring-color': error ? 'var(--destructive)' : 'var(--accent)',
						'--tw-ring-offset-color': 'transparent',
					}}
				/>

				{isPassword && (
					<button
						type="button"
						onClick={() => setRevealed((prev) => !prev)}
						disabled={disabled}
						aria-label={revealed ? 'Hide password' : 'Show password'}
						aria-pressed={revealed}
						className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/55 hover:text-foreground hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
					>
						{revealed ? (
							<EyeOff className="h-4.5 w-4.5" />
						) : (
							<Eye className="h-4.5 w-4.5" />
						)}
					</button>
				)}
			</div>

			{error && (
				<p className="mt-1 text-sm text-destructive">
					{error}
				</p>
			)}
		</div>
	)
}
