/** Client-generated key for safe POST retries (e.g. payment confirm after network timeout). */
export function createIdempotencyKey() {
  return crypto.randomUUID()
}
