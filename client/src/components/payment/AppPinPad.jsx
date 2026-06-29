import { Delete, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'

const PIN_LENGTH = 4
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']

export default function AppPinPad({
	value,
	onChange,
	onSubmit,
	isSubmitting = false,
	error = '',
	title = 'Enter app PIN',
	subtitle = 'Use your 4-digit payment PIN to confirm.',
	submitLabel = 'Confirm',
	cancelLabel = 'Cancel',
	onCancel,
}) {
	const canSubmit = value.length === PIN_LENGTH && !isSubmitting

	function appendDigit(digit) {
		if (isSubmitting || value.length >= PIN_LENGTH) return
		onChange(`${value}${digit}`)
	}

	function deleteDigit() {
		if (isSubmitting || value.length === 0) return
		onChange(value.slice(0, -1))
	}

	function handleKey(key) {
		if (!key) return
		if (key === 'delete') {
			deleteDigit()
			return
		}
		appendDigit(key)
	}

	return (
		<div className="mx-auto w-full max-w-xs">
			<div className="mb-5 text-center">
				<p className="text-base font-semibold text-card-foreground">{title}</p>
				<p className="mt-1 text-sm leading-5 text-muted-foreground">{subtitle}</p>
			</div>

			<div className="mb-5 flex justify-center gap-3" aria-label={`${value.length} of 4 PIN digits entered`}>
				{Array.from({ length: PIN_LENGTH }).map((_, index) => (
					<span
						key={index}
						className={`h-3 w-3 rounded-full transition-colors ${
							index < value.length ? 'bg-primary' : 'bg-muted ring-1 ring-border'
						}`}
					/>
				))}
			</div>

			{error && <FormBanner variant="error" message={error} />}

			<div className="mt-5 grid grid-cols-3 gap-3">
				{KEYS.map((key, index) => {
					if (!key) return <span key={`empty-${index}`} aria-hidden="true" />
					const isDelete = key === 'delete'
					return (
						<button
							key={key}
							type="button"
							onClick={() => handleKey(key)}
							disabled={isSubmitting}
							className="flex aspect-square min-h-16 items-center justify-center rounded-full border border-border bg-background text-2xl font-semibold tabular-nums text-card-foreground shadow-sm transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
							aria-label={isDelete ? 'Delete last PIN digit' : `Enter ${key}`}
						>
							{isDelete ? <Delete className="h-5 w-5" /> : key}
						</button>
					)
				})}
			</div>

			<div className="mt-6 flex gap-2">
				{onCancel && (
					<Button
						type="button"
						variant="outline"
						className="flex-1"
						onClick={onCancel}
						disabled={isSubmitting}
					>
						{cancelLabel}
					</Button>
				)}
				<Button
					type="button"
					className="flex-1"
					onClick={onSubmit}
					disabled={!canSubmit}
					aria-busy={isSubmitting}
				>
					{isSubmitting ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Verifying...
						</>
					) : (
						submitLabel
					)}
				</Button>
			</div>
		</div>
	)
}
