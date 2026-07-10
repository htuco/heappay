import { z } from 'zod'
import { strongPasswordSchema } from '@/schemas/passwordSchema'

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Current password is required'),
		newPassword: z.string().min(1, 'New password is required'),
		confirmPassword: z.string().min(1, 'Please confirm your new password'),
	})
	.superRefine((data, ctx) => {
		const passwordSchema = strongPasswordSchema('New password is required', {
			currentPassword: data.currentPassword,
		})
		const result = passwordSchema.safeParse(data.newPassword)
		if (!result.success) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: result.error.issues[0]?.message ?? 'New password is invalid.',
				path: ['newPassword'],
			})
		}
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})
