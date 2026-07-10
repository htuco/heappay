import { z } from 'zod'

import { KNOWN_TLDS } from '@/schemas/tlds'

export const EMAIL_INVALID_MESSAGE = 'Enter a valid email address.'
export const EMAIL_DOMAIN_UNSUPPORTED_MESSAGE = 'This email domain is not supported.'

const LOCAL_PART_MAX_LENGTH = 64
const DOMAIN_MAX_LENGTH = 253
const DOMAIN_LABEL_MAX_LENGTH = 63

// RFC 5322 dot-atom characters; dot placement is checked separately.
const LOCAL_PART_CHARS = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/
const DOMAIN_LABEL = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/

/**
 * Mirror of the server-side structural checks in server/utils/email_policy.py.
 * Client-side UX only — the server remains the source of truth.
 * Returns an error message, or null when the email passes.
 */
export function getEmailStructureError(value) {
	const atIndex = value.lastIndexOf('@')
	if (atIndex === -1) return EMAIL_INVALID_MESSAGE

	const localPart = value.slice(0, atIndex)
	const domain = value.slice(atIndex + 1)

	if (!localPart || localPart.length > LOCAL_PART_MAX_LENGTH) return EMAIL_INVALID_MESSAGE
	if (!LOCAL_PART_CHARS.test(localPart)) return EMAIL_INVALID_MESSAGE
	if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
		return EMAIL_INVALID_MESSAGE
	}

	if (!domain || domain.length > DOMAIN_MAX_LENGTH) return EMAIL_INVALID_MESSAGE
	const labels = domain.split('.')
	if (labels.length < 2) return EMAIL_INVALID_MESSAGE
	for (const label of labels) {
		if (!label || label.length > DOMAIN_LABEL_MAX_LENGTH) return EMAIL_INVALID_MESSAGE
		if (!DOMAIN_LABEL.test(label)) return EMAIL_INVALID_MESSAGE
	}

	const tld = labels[labels.length - 1].toLowerCase()
	if (/^\d+$/.test(tld) || !KNOWN_TLDS.has(tld)) return EMAIL_DOMAIN_UNSUPPORTED_MESSAGE

	return null
}

export const strictEmailSchema = (requiredMessage = 'Email is required') =>
	z
		.string()
		.trim()
		.min(1, requiredMessage)
		.email(EMAIL_INVALID_MESSAGE)
		.superRefine((value, ctx) => {
			const message = getEmailStructureError(value)
			if (message) ctx.addIssue({ code: 'custom', message })
		})
