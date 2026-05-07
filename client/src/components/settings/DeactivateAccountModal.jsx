import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import AuthTextInput from '@/components/auth-ui/AuthTextInput'
import { deactivateAccount } from '@/services/authService'
import { clearAuthSession } from '@/utils/authStorage'
import { getApiErrorMessage } from '@/utils/api'
import { useNotifications } from '@/context/NotificationContext'

const EMPTY = { currentPassword: '' }

export default function DeactivateAccountModal({ isOpen, onClose }) {
	const { notify } = useNotifications()
	const [form, setForm] = useState(EMPTY)
	const [errors, setErrors] = useState({})
	const [loading, setLoading] = useState(false)

	const reset = () => { setForm(EMPTY); setErrors({}) }
	const handleClose = () => { reset(); onClose() }
	const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

	const handleSubmit = async (e) => {
		e.preventDefault()
		setErrors({})

		if (!form.currentPassword) {
			setErrors({ currentPassword: 'Password is required' })
			return
		}

		setLoading(true)
		try {
			await deactivateAccount({ currentPassword: form.currentPassword })
			clearAuthSession()
			window.location.assign('/login?deactivated=1')
		} catch (err) {
			const message = getApiErrorMessage(err, 'Failed to deactivate account.')
			const lower = message.toLowerCase()
			if (lower.includes('current password')) {
				setErrors({ currentPassword: message })
			} else {
				notify({ type: 'error', message, duration: 0 })
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Deactivate Account">
			<form className="space-y-4" onSubmit={handleSubmit}>
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					<p className="font-semibold">This action is permanent.</p>
					<p className="mt-1 text-destructive/80">
						Your account will be deactivated and you will be signed out immediately.
						This cannot be undone without contacting support.
					</p>
				</div>

			<AuthTextInput
					id="currentPassword"
					name="currentPassword"
					type="password"
					label="Confirm with your current password"
					placeholder="Enter your password to confirm"
					value={form.currentPassword}
					onChange={handleChange}
					disabled={loading}
					error={errors.currentPassword}
				/>

				<div className="flex justify-end gap-2 pt-1">
					<Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
						Cancel
					</Button>
					<Button type="submit" variant="destructive" disabled={loading}>
						{loading ? 'Deactivating…' : 'Deactivate Account'}
					</Button>
				</div>
			</form>
		</Modal>
	)
}
