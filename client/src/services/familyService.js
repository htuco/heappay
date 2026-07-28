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
