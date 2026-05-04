export class CardFkError extends Error {
  constructor(field, message) {
    super(message)
    this.name = 'CardFkError'
    this.field = field
  }
}
