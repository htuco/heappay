import { z } from 'zod'

export const PASSWORD_TOO_SHORT_MESSAGE = 'Password must be at least 8 characters.'
export const PASSWORD_TOO_LONG_MESSAGE = 'Password must be at most 255 characters.'
export const PASSWORD_REQUIRES_UPPERCASE_MESSAGE =
	'Password must include at least one uppercase letter.'
export const PASSWORD_REQUIRES_LOWERCASE_MESSAGE =
	'Password must include at least one lowercase letter.'
export const PASSWORD_REQUIRES_NUMBER_MESSAGE = 'Password must include at least one number.'
export const PASSWORD_REQUIRES_SPECIAL_MESSAGE =
	'Password must include at least one special character.'
export const PASSWORD_SAME_AS_CURRENT_MESSAGE =
	'New password must be different from your current password.'
export const PASSWORD_CONTAINS_EMAIL_MESSAGE = 'Password must not contain your email address.'
export const PASSWORD_REPEATED_PATTERN_MESSAGE =
	'Password must not contain obvious repeated patterns.'
export const PASSWORD_TOO_COMMON_MESSAGE = 'Password is too common. Choose a more unique password.'

/** @deprecated Use specific rule messages; kept for legacy imports. */
export const PASSWORD_RULES_MESSAGE = PASSWORD_REQUIRES_UPPERCASE_MESSAGE

export const PASSWORD_RULES_HINT =
	'Use 8–255 characters with uppercase, lowercase, number, and special character. Avoid common passwords, repeated patterns, and your email.'

const COMMON_PASSWORD_BLOCKLIST = new Set(['password', '123456', 'password1!'])

const hasUppercase = /[A-Z]/
const hasLowercase = /[a-z]/
const hasNumber = /\d/
const hasSpecialCharacter = /[^A-Za-z0-9]/
const repeatedWordPattern = /(.{2,})\1/

/**
 * @param {string} email
 */
export function emailLocalPart(email) {
	return email.trim().split('@', 1)[0].toLowerCase()
}

/**
 * @param {string} password
 * @param {string} [email]
 */
export function passwordContainsEmailLocalPart(password, email) {
	if (!email) return false
	const local = emailLocalPart(email)
	if (local.length < 3) return false
	return password.toLowerCase().includes(local)
}

/**
 * @param {string} value
 */
export function hasRepeatedCharacterRun(value, minRun = 4) {
	if (value.length < minRun) return false
	let run = 1
	for (let index = 1; index < value.length; index += 1) {
		if (value[index] === value[index - 1]) {
			run += 1
			if (run >= minRun) return true
		} else {
			run = 1
		}
	}
	return false
}

/**
 * @param {string} value
 */
export function hasRepeatedWordPattern(value) {
	const lowered = value.toLowerCase()
	if (lowered.length >= 6 && lowered.length % 2 === 0) {
		const half = lowered.length / 2
		if (lowered.slice(0, half) === lowered.slice(half)) return true
	}
	return repeatedWordPattern.test(lowered)
}

/**
 * @param {string} value
 */
export function isCommonPassword(value) {
	const lowered = value.toLowerCase()
	return [...COMMON_PASSWORD_BLOCKLIST].some((candidate) => candidate.toLowerCase() === lowered)
}

/**
 * Returns the first failing password rule message, or null if valid.
 * @param {string} value
 * @param {{ email?: string, currentPassword?: string }} [options]
 */
export function getPasswordRuleViolation(value, options = {}) {
	if (!value) return null
	if (value.length < 8) return PASSWORD_TOO_SHORT_MESSAGE
	if (value.length > 255) return PASSWORD_TOO_LONG_MESSAGE
	if (!hasUppercase.test(value)) return PASSWORD_REQUIRES_UPPERCASE_MESSAGE
	if (!hasLowercase.test(value)) return PASSWORD_REQUIRES_LOWERCASE_MESSAGE
	if (!hasNumber.test(value)) return PASSWORD_REQUIRES_NUMBER_MESSAGE
	if (!hasSpecialCharacter.test(value)) return PASSWORD_REQUIRES_SPECIAL_MESSAGE
	if (isCommonPassword(value)) return PASSWORD_TOO_COMMON_MESSAGE
	if (hasRepeatedCharacterRun(value) || hasRepeatedWordPattern(value)) {
		return PASSWORD_REPEATED_PATTERN_MESSAGE
	}
	if (options.currentPassword && value === options.currentPassword) {
		return PASSWORD_SAME_AS_CURRENT_MESSAGE
	}
	if (passwordContainsEmailLocalPart(value, options.email)) {
		return PASSWORD_CONTAINS_EMAIL_MESSAGE
	}
	return null
}

/**
 * @param {string} [requiredMessage]
 * @param {{ email?: string, currentPassword?: string }} [options]
 */
export const strongPasswordSchema = (requiredMessage = 'Password is required', options = {}) =>
	z.string().superRefine((value, ctx) => {
		if (!value) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: requiredMessage })
			return
		}
		const violation = getPasswordRuleViolation(value, options)
		if (violation) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: violation })
		}
	})
