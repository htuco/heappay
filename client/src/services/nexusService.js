import api, { getApiErrorMessage } from '@/utils/api'
import { normalizeAmountForSubmit } from '@/utils/amount'

function unwrap(response) {
  const body = response?.data
  return body?.data ?? body
}

/**
 * @returns {Promise<boolean>}
 */
export async function getNexusFundingEnabled() {
  try {
    const { data } = await api.get('/fund-requests/config')
    const payload = unwrap({ data })
    return Boolean(payload?.enabled)
  } catch {
    return false
  }
}

/**
 * @param {number} cardId
 * @param {number|string} amount
 */
export async function requestFundTopUp(cardId, amount) {
  try {
    const normalizedAmount = normalizeAmountForSubmit(amount)
    if (!normalizedAmount) {
      throw new Error('Enter a valid amount with up to 2 decimal places.')
    }
    const { data } = await api.post(`/cards/${cardId}/fund-request`, {
      amount: normalizedAmount,
    })
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not submit funding request.'))
  }
}

/**
 * @param {string} requestId
 */
export async function getFundRequest(requestId) {
  try {
    const { data } = await api.get(`/fund-requests/${requestId}`)
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not load funding request.'))
  }
}
