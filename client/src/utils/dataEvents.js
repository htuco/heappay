const listeners = new Set()

export function subscribeDataChange(handler) {
  listeners.add(handler)
  return () => {
    listeners.delete(handler)
  }
}

export function emitDataChange(kind) {
  for (const handler of listeners) {
    try {
      handler(kind)
    } catch {
      // Listener errors must not block other subscribers.
    }
  }
}

export const DATA_CHANGE_KINDS = Object.freeze({
  TRANSACTION: 'transaction',
  CARD: 'card',
  WALLET: 'wallet',
})
