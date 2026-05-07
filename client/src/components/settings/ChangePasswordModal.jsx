import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import AuthTextInput from '@/components/auth-ui/AuthTextInput'
import FormBanner from '@/components/ui/FormBanner'
import { changePasswordSchema } from '@/schemas/changePasswordSchema'
import { changePassword } from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'

const INITIAL_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' }

// Maps a server error message to the field it belongs to, if any.
function mapApiError(message) {
	if (!message) return { field: null, message: 'Something went wrong. Please try again.' }
	const lower = message.toLowerCase()
	if (lower.includes('current password')) return { field: 'currentPassword', message }
	if (lower.includes('passwords do not match')) return { field: 'confirmPassword', message }
	return { field: null, message }
}

export default function ChangePasswordModal({ isOpen, onClose }) {
	const [form, setForm] = useState(INITIAL_FORM)
	const [fieldErrors, setFieldErrors] = useState({})
	const [bannerError, setBannerError] = useState('')
	const [success, setSuccess] = useState(false)
	const [loading, setLoading] = useState(false)

	const handleChange = (e) => {
		const { name, value } = e.target
		setForm((prev) => ({ ...prev, [name]: value }))
	}

	const handleClose = () => {
		setForm(INITIAL_FORM)
		setFieldErrors({})
		setBannerError('')
		setSuccess(false)
		onClose()
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		setFieldErrors({})
		setBannerError('')

		const result = changePasswordSchema.safeParse(form)
		if (!result.success) {
			const errs = {}
			result.error.issues.forEach((issue) => {
				if (issue.path[0]) errs[issue.path[0]] = issue.message
			})
			setFieldErrors(errs)
			return
		}

		setLoading(true)
		try {
			await changePassword({
				currentPassword: form.currentPassword,
				newPassword: form.newPassword,
			})
			setSuccess(true)
			setForm(INITIAL_FORM)
		} catch (err) {
			const message = getApiErrorMessage(err, 'Failed to update password.')
			const { field, message: mapped } = mapApiError(message)
			if (field) {
				setFieldErrors({ [field]: mapped })
			} else {
				setBannerError(mapped)
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Change Password">
			{success ? (
				<div className="space-y-4">
					<FormBanner variant="success" message="Password updated successfully." />
					<div className="flex justify-end">
						<Button onClick={handleClose}>Done</Button>
					</div>
				</div>
			) : (
				<form className="space-y-4" onSubmit={handleSubmit}>
					<FormBanner variant="error" message={bannerError} />

					<AuthTextInput
						id="currentPassword"
						name="currentPassword"
						type="password"
						label="Current Password"
						placeholder="Enter your current password"
						value={form.currentPassword}
						onChange={handleChange}
						disabled={loading}
						error={fieldErrors.currentPassword}
					/>

					<AuthTextInput
						id="newPassword"
						name="newPassword"
						type="password"
						label="New Password"
						placeholder="Minimum 8 characters"
						value={form.newPassword}
						onChange={handleChange}
						disabled={loading}
						error={fieldErrors.newPassword}
					/>

					<AuthTextInput
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						label="Confirm New Password"
						placeholder="Repeat your new password"
						value={form.confirmPassword}
						onChange={handleChange}
						disabled={loading}
						error={fieldErrors.confirmPassword}
					/>

					<p className="text-xs text-muted-foreground pt-1">
						Password must be between 8 and 255 characters.
					</p>

					<div className="flex justify-end gap-2 pt-2">
						<Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
							Cancel
						</Button>
						<Button type="submit" disabled={loading}>
							{loading ? 'Updating…' : 'Update Password'}
						</Button>
					</div>
				</form>
			)}
		</Modal>
	)
}
