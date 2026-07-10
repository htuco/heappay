import { z } from 'zod'
import { strictEmailSchema } from '@/schemas/emailSchema'
import { strongPasswordSchema } from '@/schemas/passwordSchema'

export const registerSchema = z
	.object({
		firstName: z
			.string()
			.min(1, 'First name is required')
			.min(2, 'First name must be at least 2 characters'),
		lastName: z
			.string()
			.min(1, 'Last name is required')
			.min(2, 'Last name must be at least 2 characters'),
		email: strictEmailSchema('Email is required'),
		password: z.string().min(1, 'Password is required'),
		confirmPassword: z.string().min(1, 'Confirm password is required'),
		agreedToTerms: z
			.boolean()
			.refine((val) => val === true, 'You must agree to the Terms of Service'),
	})
	.superRefine((data, ctx) => {
		const passwordSchema = strongPasswordSchema('Password is required', { email: data.email })
		const result = passwordSchema.safeParse(data.password)
		if (!result.success) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: result.error.issues[0]?.message ?? 'Password is invalid.',
				path: ['password'],
			})
		}
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})
