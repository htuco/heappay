import { z } from 'zod'
import { personNameSchema } from '@/schemas/personNameSchema'
import { strongPasswordSchema } from '@/schemas/passwordSchema'

export const registerSchema = z.object({
	firstName: personNameSchema('First name', { minLength: 2 }),
	lastName: personNameSchema('Last name', { minLength: 2 }),
	email: z
		.string()
		.min(1, 'Email is required')
		.email('Invalid email format'),
	password: strongPasswordSchema('Password is required'),
	confirmPassword: z
		.string()
		.min(1, 'Confirm password is required'),
	agreedToTerms: z
		.boolean()
		.refine(val => val === true, 'You must agree to the Terms of Service')
}).refine(data => data.password === data.confirmPassword, {
	message: 'Passwords do not match',
	path: ['confirmPassword']
})
