import api from '@/utils/api'
import { CardFkError } from '@/types/card'

const FK_ERROR_MAP = {
  'User not found.': 'user_id',
  'Card status not found.': 'status_id',
  'Card type not found.': 'card_type_id',
}

function httpErrorText(response) {
  const data = response?.data
  if (typeof data?.message === 'string') return data.message
  if (typeof data?.detail === 'string') return data.detail
  return null
}

function normalizeError(error) {
  const response = error?.response
  const msg = httpErrorText(response)

  if (response?.status === 409) {
    throw new CardFkError('card_numb', msg ?? 'A card with this number is already registered.')
  }

  if (response?.status === 404 && msg) {
    const field = FK_ERROR_MAP[msg]
    if (field) {
      throw new CardFkError(field, msg)
    }
  }

  throw error
}

/**
 * Look up a card by its full card number.
 * Returns card_id, masked number, owner name, owner email, and user_id.
 * Throws if no active card with that number exists.
 * @param {string} cardNumber - Raw digits (spaces/dashes are stripped server-side)
 */
export async function lookupCardByNumber(cardNumber) {
  const { data } = await api.get('/cards/lookup', {
    params: { card_number: cardNumber.replace(/\D/g, '') },
  })
  return data
}

export async function listCards(params) {
  const { data } = await api.get('/cards', { params })
  return data
}

export async function listDeletedCards(params) {
  const { data } = await api.get('/cards/deleted', { params })
  return data
}

export async function getCard(cardId) {
  const { data } = await api.get(`/cards/${cardId}`)
  return data
}

export async function createCard(payload) {
  try {
    const { data } = await api.post('/cards', payload)
    return data
  } catch (error) {
    normalizeError(error)
  }
}

export async function updateCard(cardId, payload) {
  try {
    const { data } = await api.patch(`/cards/${cardId}`, payload)
    return data
  } catch (error) {
    normalizeError(error)
  }
}

export async function deleteCard(cardId) {
  await api.delete(`/cards/${cardId}`)
}

export async function restoreCard(cardId) {
  const { data } = await api.post(`/cards/${cardId}/restore`)
  return data
}

export async function blockCard(cardId) {
  const { data } = await api.post(`/cards/${cardId}/block`)
  return data
}

export async function unblockCard(cardId) {
  const { data } = await api.post(`/cards/${cardId}/unblock`)
  return data
}

export async function getMainCard(userId) {
  const { data } = await api.get('/cards/main', { params: { user_id: userId } })
  return data
}

export async function setMainCard(cardId) {
  const { data } = await api.patch(`/cards/${cardId}/set-main`)
  return data
}
