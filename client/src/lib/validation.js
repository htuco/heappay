import { z } from 'zod'

export const registerSchema = z.object({
	firstName: z
		.string()
		.min(1, 'First name is required')
		.min(2, 'First name must be at least 2 characters'),
	lastName: z
		.string()
		.min(1, 'Last name is required')
		.min(2, 'Last name must be at least 2 characters'),
	email: z
		.string()
		.min(1, 'Email is required')
		.regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid email format'),
	password: z
		.string()
		.min(1, 'Password is required')
		.min(8, 'Password must be at least 8 characters'),
	confirmPassword: z
		.string()
		.min(1, 'Confirm password is required')
}).refine(data => data.password === data.confirmPassword, {
	message: 'Passwords do not match',
	path: ['confirmPassword']
})
