import { z } from 'zod'
import { strongPasswordSchema } from '@/schemas/passwordSchema'

export const invitationPasswordSchema = z
	.object({
		newPassword: z.string().min(1, 'Password is required'),
		confirmPassword: z.string().min(1, 'Please confirm your password'),
	})
	.superRefine((data, ctx) => {
		const passwordSchema = strongPasswordSchema('Password is required')
		const result = passwordSchema.safeParse(data.newPassword)
		if (!result.success) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: result.error.issues[0]?.message ?? 'Password is invalid.',
				path: ['newPassword'],
			})
		}
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})

/**
 * Invitation onboarding should match register strength rules once email is known.
 * @param {string | undefined} email
 */
export function createInvitationPasswordSchema(email) {
	return z
		.object({
			newPassword: z.string().min(1, 'Password is required'),
			confirmPassword: z.string().min(1, 'Please confirm your password'),
		})
		.superRefine((data, ctx) => {
			const passwordSchema = strongPasswordSchema('Password is required', { email })
			const result = passwordSchema.safeParse(data.newPassword)
			if (!result.success) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: result.error.issues[0]?.message ?? 'Password is invalid.',
					path: ['newPassword'],
				})
			}
		})
		.refine((data) => data.newPassword === data.confirmPassword, {
			message: 'Passwords do not match',
			path: ['confirmPassword'],
		})
}
