import api, { getApiErrorMessage } from '@/utils/api'

function unwrap(response) {
  const body = response?.data
  return body?.data ?? body
}

/**
 * Current user's saved contacts (address book).
 * @param {string} [q] optional filter by name, alias, or email
 * @returns {Promise<Array>}
 */
export async function listContacts(q) {
  try {
    const { data } = await api.get('/contacts', {
      params: q ? { q } : undefined,
    })
    return unwrap({ data }) ?? []
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not load your contacts.'))
  }
}

/**
 * @param {{ contact_user_id: number, alias?: string|null }} payload
 * @returns {Promise<object>}
 */
export async function addContact({ contact_user_id, alias }) {
  try {
    const { data } = await api.post('/contacts', { contact_user_id, alias })
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not add this contact.'))
  }
}

/**
 * @param {number} contactId
 * @param {{ alias?: string|null, is_favorite?: boolean }} payload
 * @returns {Promise<object>}
 */
export async function updateContact(contactId, payload) {
  try {
    const { data } = await api.patch(`/contacts/${contactId}`, payload)
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not update this contact.'))
  }
}

/**
 * @param {number} contactId
 * @returns {Promise<void>}
 */
export async function removeContact(contactId) {
  try {
    await api.delete(`/contacts/${contactId}`)
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not remove this contact.'))
  }
}
