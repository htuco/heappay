import {
	ArrowDownLeft,
	ArrowUpRight,
	ArrowLeftRight,
	Ban,
	RefreshCcw,
	RotateCcw,
	XCircle,
	CreditCard,
	ShieldAlert,
	UserX,
	UserCheck,
	UserMinus,
	KeyRound,
	Info,
	CheckCircle,
	AlertTriangle,
} from 'lucide-react'
import { CATEGORIES } from '@/context/notifications/categories'

/**
 * Per-category visual metadata.
 *
 * accent — Tailwind text-color token used for the left-rule, icon tint,
 *          and (at low opacity) the unread row background.
 * Icon   — lucide-react component rendered in the row's leading slot.
 */
export const NOTIFICATION_META = {
	[CATEGORIES.PAYMENT_SENT]:        { accent: 'primary',     Icon: ArrowUpRight },
	[CATEGORIES.PAYMENT_RECEIVED]:    { accent: 'success',     Icon: ArrowDownLeft },
	[CATEGORIES.PAYMENT_SELF]:        { accent: 'primary',     Icon: ArrowLeftRight },
	[CATEGORIES.PAYMENT_CANCELLED]:   { accent: 'muted',       Icon: Ban },
	[CATEGORIES.REFUND_REQUESTED]:    { accent: 'warning',     Icon: RefreshCcw },
	[CATEGORIES.REFUND_APPROVED]:     { accent: 'success',     Icon: RotateCcw },
	[CATEGORIES.REFUND_DECLINED]:     { accent: 'destructive', Icon: XCircle },
	[CATEGORIES.CARD_BLOCKED]:        { accent: 'destructive', Icon: ShieldAlert },
	[CATEGORIES.CARD_UNBLOCKED]:      { accent: 'success',     Icon: CreditCard },
	[CATEGORIES.CARD_EXPIRING]:       { accent: 'warning',     Icon: AlertTriangle },
	[CATEGORIES.CARD_EXPIRED]:        { accent: 'destructive', Icon: AlertTriangle },
	[CATEGORIES.CARD_BALANCE_SWEPT]:  { accent: 'success',     Icon: ArrowLeftRight },
	[CATEGORIES.CARD_REMOVED]:        { accent: 'muted',       Icon: CreditCard },
	[CATEGORIES.ACCOUNT_SUSPENDED]:   { accent: 'destructive', Icon: UserX },
	[CATEGORIES.ACCOUNT_REACTIVATED]: { accent: 'success',     Icon: UserCheck },
	[CATEGORIES.ACCOUNT_DEACTIVATED]: { accent: 'muted',       Icon: UserMinus },
	[CATEGORIES.SECURITY]:            { accent: 'primary',     Icon: KeyRound },
	[CATEGORIES.ADMIN_ACTION]:        { accent: 'primary',     Icon: Info },
	[CATEGORIES.SYSTEM]:              { accent: 'muted',       Icon: Info },
}

/**
 * Fallback for legacy items that only have `type` ('success' | 'error' | …)
 * and no `category`. Used until every notify() call site is migrated.
 */
export const TYPE_FALLBACK = {
	success: { accent: 'success',     Icon: CheckCircle },
	error:   { accent: 'destructive', Icon: XCircle },
	warning: { accent: 'warning',     Icon: AlertTriangle },
	info:    { accent: 'muted',       Icon: Info },
}

export function getNotificationMeta(item) {
	if (item?.category && NOTIFICATION_META[item.category]) {
		return NOTIFICATION_META[item.category]
	}
	return TYPE_FALLBACK[item?.type] ?? TYPE_FALLBACK.info
}

/**
 * Accent color → Tailwind class fragments.
 * Keeps JIT happy (full class names, no string interpolation that JIT can't see).
 */
export const ACCENT_CLASSES = {
	primary: {
		text:   'text-primary',
		rule:   'bg-primary',
		tintBg: 'bg-primary/5',
	},
	success: {
		text:   'text-success',
		rule:   'bg-success',
		tintBg: 'bg-success/5',
	},
	warning: {
		text:   'text-warning',
		rule:   'bg-warning',
		tintBg: 'bg-warning/5',
	},
	destructive: {
		text:   'text-destructive',
		rule:   'bg-destructive',
		tintBg: 'bg-destructive/5',
	},
	muted: {
		text:   'text-muted-foreground',
		rule:   'bg-muted-foreground/40',
		tintBg: 'bg-muted/30',
	},
}

export function getAccentClasses(accent) {
	return ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.muted
}
