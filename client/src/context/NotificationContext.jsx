import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import { useSelector } from 'react-redux'
import { selectAuthUser } from '@/store/slices/authSlice'
import {
	loadHistory,
	saveHistory,
	loadDedupSet,
	saveDedupSet,
	NOTIFICATION_HISTORY_CAP,
} from './notifications/storage'
import { CATEGORIES } from './notifications/categories'

const DEFAULT_CATEGORY = CATEGORIES.SYSTEM

const NotificationContext = createContext(null)

let _nextId = 1

/**
 * Notification model
 *
 * notify({
 *   type,        // 'success' | 'error' | 'warning' | 'info'  (toast styling)
 *   message,     // string
 *   category,    // semantic kind — drives icon + link routing
 *                // see CATEGORIES below
 *   link,        // optional { route: '/payments', modal?: { kind, id } }
 *   surface,     // 'toast' | 'panel' | 'both'  (default 'both')
 *   duration,    // toast auto-dismiss ms; 0 = sticky; ignored if surface === 'panel'
 *   dedupKey,    // optional — if a row with this key already exists, the new
 *                //            notify call is dropped. Used by pollers.
 * })
 */

export function NotificationProvider({ children }) {
	const user = useSelector(selectAuthUser)
	const userId = user?.id ?? null

	const [history, setHistory] = useState([])
	const [queue, setQueue] = useState([])
	const timers = useRef({})
	const dedupRef = useRef(new Set())
	const hydratedFor = useRef(null)

	// Hydrate from localStorage when the user changes (login / hydrateSession)
	useEffect(() => {
		// clear any pending toast timers from the previous user
		Object.values(timers.current).forEach(clearTimeout)
		timers.current = {}
		setQueue([])

		if (!userId) {
			setHistory([])
			dedupRef.current = new Set()
			hydratedFor.current = null
			return
		}

		const stored = loadHistory(userId)
		setHistory(stored)
		dedupRef.current = loadDedupSet(userId)
		hydratedFor.current = userId
	}, [userId])

	// Persist on every history change (skip until hydrated)
	useEffect(() => {
		if (!userId || hydratedFor.current !== userId) return
		saveHistory(userId, history)
	}, [userId, history])

	const dismiss = useCallback((id) => {
		clearTimeout(timers.current[id])
		delete timers.current[id]
		setQueue((prev) => prev.filter((n) => n.id !== id))
	}, [])

	const notify = useCallback(
		({
			type = 'info',
			message,
			category = DEFAULT_CATEGORY,
			link = null,
			surface = 'both',
			duration = 3500,
			dedupKey = null,
		}) => {
			if (dedupKey && dedupRef.current.has(dedupKey)) {
				return null
			}

			const id = _nextId++
			const item = {
				id,
				type,
				message,
				category,
				link,
				surface,
				duration,
				dedupKey,
				read: false,
				createdAt: Date.now(),
			}

			if (dedupKey) {
				dedupRef.current.add(dedupKey)
				if (userId) saveDedupSet(userId, dedupRef.current)
			}

			if (surface !== 'panel') {
				setQueue((prev) => [...prev, item])
				if (duration > 0) {
					timers.current[id] = setTimeout(() => dismiss(id), duration)
				}
			}

			if (surface !== 'toast') {
				setHistory((prev) => [item, ...prev].slice(0, NOTIFICATION_HISTORY_CAP))
			}

			return id
		},
		[userId, dismiss],
	)

	const markRead = useCallback((id) => {
		setHistory((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
	}, [])

	const markAllRead = useCallback(() => {
		setHistory((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })))
	}, [])

	const discard = useCallback((id) => {
		setHistory((prev) => prev.filter((n) => n.id !== id))
	}, [])

	const clearHistory = useCallback(() => {
		setHistory([])
	}, [])

	const unreadCount = useMemo(
		() => history.reduce((acc, n) => (n.read ? acc : acc + 1), 0),
		[history],
	)

	const value = useMemo(
		() => ({
			queue,
			history,
			unreadCount,
			notify,
			dismiss,
			markRead,
			markAllRead,
			discard,
			clearHistory,
		}),
		[queue, history, unreadCount, notify, dismiss, markRead, markAllRead, discard, clearHistory],
	)

	return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
	const ctx = useContext(NotificationContext)
	if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider')
	return ctx
}
