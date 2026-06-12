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
	loadSeenAt,
	saveSeenAt,
	NOTIFICATION_HISTORY_CAP,
} from './notifications/storage'
import { CATEGORIES } from './notifications/categories'
import { useIncomingTransferWatcher } from './notifications/useIncomingTransferWatcher'
import { useAccountEventsWatcher } from './notifications/useAccountEventsWatcher'
import { useCardExpiryWatcher } from './notifications/useCardExpiryWatcher'
import { useCardExpirySweepWatcher } from './notifications/useCardExpirySweepWatcher'
import { usePendingRefundWatcher } from './notifications/usePendingRefundWatcher'
import { subscribeDataChange, DATA_CHANGE_KINDS } from '@/utils/dataEvents'

const DEFAULT_CATEGORY = CATEGORIES.SYSTEM

const NotificationContext = createContext(null)

// Notification ids must be unique across the whole app lifetime AND stable
// across reloads — history is persisted in localStorage, so a counter that
// resets to 1 on every page load (or HMR) collides with already-stored ids and
// produces duplicate React keys (which silently breaks list reconciliation,
// e.g. row clicks / "Clear all" not firing). Seed from a UUID/timestamp so a
// fresh session can never reuse a persisted id.
let _idSeq = 0
function nextNotificationId() {
	_idSeq += 1
	const rand =
		typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2)
	return `n_${Date.now().toString(36)}_${_idSeq}_${rand}`
}

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
	// `seenAt` = last time the panel was opened. Items newer than this drive the
	// bell dot ("something new arrived"). It is deliberately separate from each
	// item's `read` flag: opening the panel clears the dot but must NOT mark
	// rows read, so the unread styling (accent rule, tint, bold) survives the
	// open and the user can still scan what's new. `read` flips only on an
	// explicit interaction (row click or "Mark all as read").
	const [seenAt, setSeenAt] = useState(0)
	const dedupRef = useRef(new Set())
	const hydratedFor = useRef(null)
	const selfCardActionRef = useRef(0)

	// Hydrate from localStorage when the user changes (login / hydrateSession)
	useEffect(() => {
		setQueue([])

		if (!userId) {
			setHistory([])
			setSeenAt(0)
			dedupRef.current = new Set()
			hydratedFor.current = null
			return
		}

		const stored = loadHistory(userId)
		setHistory(stored)
		setSeenAt(loadSeenAt(userId))
		dedupRef.current = loadDedupSet(userId)
		hydratedFor.current = userId
	}, [userId])

	// Persist on every history change (skip until hydrated)
	useEffect(() => {
		if (!userId || hydratedFor.current !== userId) return
		saveHistory(userId, history)
	}, [userId, history])

	const dismiss = useCallback((id) => {
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

			const id = nextNotificationId()
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
				// Auto-dismiss is owned by the Toast component itself so it can
				// play an exit animation before removal.
			}

			if (surface !== 'toast') {
				setHistory((prev) => [item, ...prev].slice(0, NOTIFICATION_HISTORY_CAP))
			}

			return id
		},
		[userId],
	)

	// Treat any CARD data-change event as a "user just did this" signal so
	// the account-events watcher can skip notifying on the same change.
	useEffect(() => {
		const unsubscribe = subscribeDataChange((kind) => {
			if (kind === DATA_CHANGE_KINDS.CARD) {
				selfCardActionRef.current = Date.now()
			}
		})
		return unsubscribe
	}, [])

	useIncomingTransferWatcher({ userId, notify })
	useAccountEventsWatcher({ userId, notify, selfActionRef: selfCardActionRef })
	useCardExpiryWatcher({ userId, notify })
	useCardExpirySweepWatcher({ userId, notify, selfActionRef: selfCardActionRef })
	usePendingRefundWatcher({ userId, notify })

	const markRead = useCallback((id) => {
		setHistory((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
	}, [])

	const markAllRead = useCallback(() => {
		setHistory((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })))
	}, [])

	// Clears the bell dot without touching `read`, so rows keep their unread
	// styling after the panel opens. Called on panel open.
	const markAllSeen = useCallback(() => {
		const now = Date.now()
		setSeenAt(now)
		if (userId) saveSeenAt(userId, now)
	}, [userId])

	const discard = useCallback((id) => {
		setHistory((prev) => prev.filter((n) => n.id !== id))
	}, [])

	const clearHistory = useCallback(() => {
		setHistory([])
	}, [])

	// Drives row styling + the in-panel count badge — only clears on interaction.
	const unreadCount = useMemo(
		() => history.reduce((acc, n) => (n.read ? acc : acc + 1), 0),
		[history],
	)

	// Drives the bell dot — "something arrived since you last opened the panel".
	const dotCount = useMemo(
		() => history.reduce((acc, n) => (n.createdAt > seenAt ? acc + 1 : acc), 0),
		[history, seenAt],
	)

	const value = useMemo(
		() => ({
			queue,
			history,
			unreadCount,
			dotCount,
			notify,
			dismiss,
			markRead,
			markAllRead,
			markAllSeen,
			discard,
			clearHistory,
		}),
		[queue, history, unreadCount, dotCount, notify, dismiss, markRead, markAllRead, markAllSeen, discard, clearHistory],
	)

	return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
	const ctx = useContext(NotificationContext)
	if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider')
	return ctx
}
