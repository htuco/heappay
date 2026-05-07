import { createContext, useCallback, useContext, useRef, useState } from 'react'

const NotificationContext = createContext(null)

let _nextId = 1

/**
 * Provides notify() and dismiss() to the component tree.
 *
 * notify({ type, message, duration? })
 *   type:     'success' | 'error' | 'warning' | 'info'
 *   message:  string
 *   duration: ms before auto-dismiss (default 3500, 0 = sticky)
 *
 * Also exposes `history` — an ordered list of every notification
 * shown in the session, used by the Bell panel.
 */
export function NotificationProvider({ children }) {
	const [queue, setQueue] = useState([])
	const [history, setHistory] = useState([])
	const timers = useRef({})

	const dismiss = useCallback((id) => {
		clearTimeout(timers.current[id])
		delete timers.current[id]
		setQueue((prev) => prev.filter((n) => n.id !== id))
	}, [])

	const notify = useCallback(({ type = 'info', message, duration = 3500 }) => {
		const id = _nextId++
		const item = { id, type, message, duration, createdAt: Date.now() }

		setQueue((prev) => [...prev, item])
		setHistory((prev) => [item, ...prev].slice(0, 50))

		if (duration > 0) {
			timers.current[id] = setTimeout(() => dismiss(id), duration)
		}

		return id
	}, [dismiss])

	const clearHistory = useCallback(() => setHistory([]), [])

	return (
		<NotificationContext.Provider value={{ queue, history, notify, dismiss, clearHistory }}>
			{children}
		</NotificationContext.Provider>
	)
}

export function useNotifications() {
	const ctx = useContext(NotificationContext)
	if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider')
	return ctx
}
