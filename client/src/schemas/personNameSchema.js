import { z } from 'zod'

export const PERSON_NAME_MIN_LENGTH = 1
export const PERSON_NAME_MAX_LENGTH = 100

export const PERSON_NAME_RULES_MESSAGE =
	'Use letters only. Spaces, hyphens, and apostrophes are allowed.'

const SEPARATORS = new Set([' ', '-', "'", '\u2019', '.'])

function isLetterOrMark(char) {
	return /\p{L}|\p{M}/u.test(char)
}

export function normalizePersonName(value) {
	return value.trim().replace(/\s+/g, ' ')
}

export function validatePersonName(value, label = 'Name') {
	const normalized = normalizePersonName(value)

	if (normalized.length < PERSON_NAME_MIN_LENGTH) {
		return `${label} is required`
	}
	if (normalized.length > PERSON_NAME_MAX_LENGTH) {
		return `${label} must be at most ${PERSON_NAME_MAX_LENGTH} characters`
	}
	if (/\d/.test(normalized)) {
		return `${label} cannot contain numbers`
	}
	if (![...normalized].some(isLetterOrMark)) {
		return PERSON_NAME_RULES_MESSAGE
	}

	let prevWasSeparator = false
	for (const char of normalized) {
		if (isLetterOrMark(char)) {
			prevWasSeparator = false
			continue
		}
		if (SEPARATORS.has(char)) {
			if (prevWasSeparator) {
				return PERSON_NAME_RULES_MESSAGE
			}
			prevWasSeparator = true
			continue
		}
		return PERSON_NAME_RULES_MESSAGE
	}

	if (!isLetterOrMark(normalized[0])) {
		return PERSON_NAME_RULES_MESSAGE
	}

	const last = normalized.at(-1)
	if (!isLetterOrMark(last) && last !== '.') {
		return PERSON_NAME_RULES_MESSAGE
	}
	if (last === ' ' || last === '-' || last === "'" || last === '\u2019') {
		return PERSON_NAME_RULES_MESSAGE
	}

	return null
}

export function personNameSchema(label, { minLength = PERSON_NAME_MIN_LENGTH } = {}) {
	return z
		.string()
		.min(1, `${label} is required`)
		.max(PERSON_NAME_MAX_LENGTH, `${label} must be at most ${PERSON_NAME_MAX_LENGTH} characters`)
		.transform(normalizePersonName)
		.refine((value) => value.length >= minLength, {
			message:
				minLength > 1
					? `${label} must be at least ${minLength} characters`
					: `${label} is required`,
		})
		.superRefine((value, ctx) => {
			const message = validatePersonName(value, label)
			if (message) {
				ctx.addIssue({ code: z.ZodIssueCode.custom, message })
			}
		})
}
