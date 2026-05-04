import api from '@/utils/api'
import { CardFkError } from '@/types/card'

const FK_ERROR_MAP = {
  'User not found.': 'user_id',
  'Card status not found.': 'status_id',
  'Card type not found.': 'card_type_id',
}

function normalizeError(error) {
  const response = error?.response

  if (response?.status === 404 && typeof response.data?.detail === 'string') {
    const field = FK_ERROR_MAP[response.data.detail]
    if (field) {
      throw new CardFkError(field, response.data.detail)
    }
  }

  throw error
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
