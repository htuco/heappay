export interface Card {
  card_id: number
  user_id: number
  status_id: number
  card_type_id: number
  last_four: string
  masked_card_number: string
  expires_at: string
  created_at: string
  deleted_at: string | null
}

export interface CardCreatePayload {
  user_id: number
  status_id: number
  card_type_id: number
  card_numb: string
  cvc: string
  expires_at: string
}

export type CardPatchPayload = Partial<CardCreatePayload>

export interface CardListParams {
  user_id?: number
  status_id?: number
  card_type_id?: number
  limit?: number
  offset?: number
}

export type CardFkField = 'user_id' | 'status_id' | 'card_type_id'

export class CardFkError extends Error {
  field: CardFkField

  constructor(field: CardFkField, message: string) {
    super(message)
    this.name = 'CardFkError'
    this.field = field
  }
}
