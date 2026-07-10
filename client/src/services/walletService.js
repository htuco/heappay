import api, { getApiErrorMessage } from '@/utils/api'
import { normalizeAmountForSubmit } from '@/utils/amount'

function unwrap(response) {
  const body = response?.data
  return body?.data ?? body
}

/**
 * Current wallet (unallocated) balance for the signed-in user.
 * @returns {Promise<number>}
 */
export async function getWalletBalance() {
  try {
    const { data } = await api.get('/wallet')
    const payload = unwrap({ data })
    return Number(payload?.wallet_balance ?? 0)
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not load wallet balance.'))
  }
}

/**
 * Move money between the wallet and a card.
 * @param {{ direction: 'to_card' | 'to_wallet', cardId: number, amount: number|string }} params
 * @returns {Promise<{ direction: string, card_id: number, amount: number, wallet_balance: number }>}
 */
export async function createWalletTransfer({ direction, cardId, amount }) {
  const normalizedAmount = normalizeAmountForSubmit(amount)
  if (!normalizedAmount) {
    throw new Error('Enter a valid amount with up to 2 decimal places.')
  }
  try {
    const { data } = await api.post('/wallet/transfers', {
      direction,
      card_id: cardId,
      amount: normalizedAmount,
    })
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not complete the transfer.'))
  }
}
