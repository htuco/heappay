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

// ── Allowance ────────────────────────────────────────────────────────────────

export async function sendAllowance(dependentUserId, amount) {
	try {
		const { data } = await api.post(`/family/dependents/${dependentUserId}/allowance`, { amount })
		return unwrap({ data })
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not send this allowance.'))
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

// ── Dependent cards (issue / freeze / unfreeze) ─────────────────────────────
// Listing reuses the existing GET /cards?user_id= endpoint, which already
// accepts an accepted guardian as well as the card's own owner.

export async function listDependentCards(dependentUserId) {
	try {
		const { data } = await api.get('/cards', { params: { user_id: dependentUserId } })
		return data
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not load this dependent’s cards.'))
	}
}

export async function freezeDependentCard(dependentUserId, cardId) {
	try {
		const { data } = await api.post(
			`/family/dependents/${dependentUserId}/cards/${cardId}/freeze`,
		)
		return data
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not freeze this card.'))
	}
}

export async function unfreezeDependentCard(dependentUserId, cardId) {
	try {
		const { data } = await api.post(
			`/family/dependents/${dependentUserId}/cards/${cardId}/unfreeze`,
		)
		return data
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not unfreeze this card.'))
	}
}

export async function issueDependentCard(dependentUserId, payload) {
	try {
		const { data } = await api.post(`/family/dependents/${dependentUserId}/cards`, payload)
		return data
	} catch (error) {
		throw new Error(getApiErrorMessage(error, 'Could not issue this card.'))
	}
}
