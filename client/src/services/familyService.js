import api, { getApiErrorMessage } from '@/utils/api'

function unwrap(response) {
	const body = response?.data
	return body?.data ?? body
}

// ── Family links (invite / accept / decline / revoke) ──────────────────────

export async function inviteDependent(dependentEmail) {
	try {
		const { data } = await api.post('/family/invites', { dependent_email: dependentEmail })
		return unwrap({ data })
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not send this invite.'))
	}
}

export async function listIncomingInvites() {
	try {
		const { data } = await api.get('/family/invites')
		return unwrap({ data }) ?? []
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not load your invites.'))
	}
}

export async function acceptInvite(familyLinkId) {
	try {
		const { data } = await api.post(`/family/invites/${familyLinkId}/accept`)
		return unwrap({ data })
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not accept this invite.'))
	}
}

export async function declineInvite(familyLinkId) {
	try {
		const { data } = await api.post(`/family/invites/${familyLinkId}/decline`)
		return unwrap({ data })
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not decline this invite.'))
	}
}

export async function revokeFamilyLink(familyLinkId) {
	try {
		const { data } = await api.post(`/family/links/${familyLinkId}/revoke`)
		return unwrap({ data })
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not remove this family link.'))
	}
}

export async function listDependents() {
	try {
		const { data } = await api.get('/family/dependents')
		return unwrap({ data }) ?? []
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not load your dependents.'))
	}
}

// ── Spending limits ──────────────────────────────────────────────────────────

export async function listSpendingLimits(dependentUserId) {
	try {
		const { data } = await api.get(`/family/dependents/${dependentUserId}/spending-limits`)
		return unwrap({ data }) ?? []
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not load spending limits.'))
	}
}

export async function createSpendingLimit(dependentUserId, payload) {
	try {
		const { data } = await api.post(
			`/family/dependents/${dependentUserId}/spending-limits`,
			payload,
		)
		return unwrap({ data })
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not create this spending limit.'))
	}
}

export async function updateSpendingLimit(dependentUserId, spendingLimitRuleId, payload) {
	try {
		const { data } = await api.patch(
			`/family/dependents/${dependentUserId}/spending-limits/${spendingLimitRuleId}`,
			payload,
		)
		return unwrap({ data })
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not update this spending limit.'))
	}
}

export async function deleteSpendingLimit(dependentUserId, spendingLimitRuleId) {
	try {
		await api.delete(`/family/dependents/${dependentUserId}/spending-limits/${spendingLimitRuleId}`)
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not remove this spending limit.'))
	}
}
