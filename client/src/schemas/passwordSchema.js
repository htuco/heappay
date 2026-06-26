import { z } from 'zod'

export const PASSWORD_RULES_MESSAGE =
	'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character.'

export const PASSWORD_RULES_HINT =
	'Use 8-255 characters with uppercase, lowercase, number, and special character.'

const hasUppercase = /[A-Z]/
const hasLowercase = /[a-z]/
const hasNumber = /\d/
const hasSpecialCharacter = /[^A-Za-z0-9]/

export const strongPasswordSchema = (requiredMessage = 'Password is required') =>
	z
		.string()
		.min(1, requiredMessage)
		.min(8, 'Password must be at least 8 characters')
		.max(255, 'Password must be at most 255 characters')
		.refine(
			(value) =>
				hasUppercase.test(value) &&
				hasLowercase.test(value) &&
				hasNumber.test(value) &&
				hasSpecialCharacter.test(value),
			PASSWORD_RULES_MESSAGE,
		)
