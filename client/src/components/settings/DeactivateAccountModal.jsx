import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import AuthTextInput from '@/components/auth-ui/AuthTextInput'
import { deactivateAccount } from '@/services/authService'
import { clearAuthSession } from '@/utils/authStorage'
import { getApiErrorMessage } from '@/utils/api'
import { useNotifications } from '@/context/NotificationContext'
import { useAppDispatch } from '@/store/hooks'
import { clearAuthState } from '@/store/slices/authSlice'

const EMPTY = { currentPassword: '' }

export default function DeactivateAccountModal({ isOpen, onClose }) {
	const dispatch = useAppDispatch()
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
			dispatch(clearAuthState())
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
				<div className="space-y-2 rounded-input border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
					<p className="font-semibold text-amber-700 dark:text-amber-300">
						Before you deactivate
					</p>
					<ul className="space-y-1.5 text-amber-800/90 dark:text-amber-200/90">
						<li className="flex gap-2">
							<span aria-hidden="true">•</span>
							<span>You&apos;ll be signed out right away on every device.</span>
						</li>
						<li className="flex gap-2">
							<span aria-hidden="true">•</span>
							<span>Your account, cards, and history are hidden, not deleted.</span>
						</li>
						<li className="flex gap-2">
							<span aria-hidden="true">•</span>
							<span>You can restore access later by contacting support.</span>
						</li>
					</ul>
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
