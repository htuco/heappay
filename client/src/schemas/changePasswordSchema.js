import { z } from 'zod'

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Current password is required'),
		newPassword: z
			.string()
			.min(1, 'New password is required')
			.min(8, 'Password must be at least 8 characters')
			.max(255, 'Password must be at most 255 characters'),
		confirmPassword: z.string().min(1, 'Please confirm your new password'),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})
