import api from '@/utils/api'
import { CardFkError } from '@/types/card'
import type { Card, CardCreatePayload, CardPatchPayload, CardListParams, CardFkField } from '@/types/card'

const FK_ERROR_MAP: Record<string, CardFkField> = {
  'User not found.': 'user_id',
  'Card status not found.': 'status_id',
  'Card type not found.': 'card_type_id',
}

function normalizeError(error: unknown): never {
  const response = (error as { response?: { status?: number; data?: { detail?: string } } })?.response

  if (response?.status === 404 && typeof response.data?.detail === 'string') {
    const field = FK_ERROR_MAP[response.data.detail]
    if (field) {
      throw new CardFkError(field, response.data.detail)
    }
  }

  throw error
}

export async function listCards(params?: CardListParams): Promise<Card[]> {
  const { data } = await api.get<Card[]>('/cards', { params })
  return data
}

export async function listDeletedCards(params?: CardListParams): Promise<Card[]> {
  const { data } = await api.get<Card[]>('/cards/deleted', { params })
  return data
}

export async function getCard(cardId: number): Promise<Card> {
  const { data } = await api.get<Card>(`/cards/${cardId}`)
  return data
}

export async function createCard(payload: CardCreatePayload): Promise<Card> {
  try {
    const { data } = await api.post<Card>('/cards', payload)
    return data
  } catch (error) {
    normalizeError(error)
  }
}

export async function updateCard(cardId: number, payload: CardPatchPayload): Promise<Card> {
  try {
    const { data } = await api.patch<Card>(`/cards/${cardId}`, payload)
    return data
  } catch (error) {
    normalizeError(error)
  }
}

export async function deleteCard(cardId: number): Promise<void> {
  await api.delete(`/cards/${cardId}`)
}

export async function restoreCard(cardId: number): Promise<Card> {
  const { data } = await api.post<Card>(`/cards/${cardId}/restore`)
  return data
}
