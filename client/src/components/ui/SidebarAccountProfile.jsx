import { useEffect, useMemo, useState } from 'react'
import { Calendar, Camera, CreditCard, Receipt, Wallet } from 'lucide-react'
import AvatarUploadModal from '@/components/settings/AvatarUploadModal'
import UserAvatar from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/context/NotificationContext'
import { useAuth } from '@/hooks/useAuth'
import { listCards } from '@/services/cardsService'
import transactionsService from '@/services/transactionsService'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'

const emptyProfileStats = {
  isLoading: false,
  error: null,
  cardCount: 0,
  transactionCount: 0,
  totalBalance: 0,
}

function getUserName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || 'Heap user'
}

function formatRole(role) {
  if (!role) return 'User'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
}

function formatJoinDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Join date unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatMembershipDuration(value) {
  const joinedAt = new Date(value)
  if (Number.isNaN(joinedAt.getTime())) return 'New member'

  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.max(0, Math.floor((Date.now() - joinedAt.getTime()) / dayMs))
  if (days < 1) return 'Today'
  if (days < 30) return `${days} day${days === 1 ? '' : 's'}`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`

  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (!remainingMonths) return `${years} year${years === 1 ? '' : 's'}`
  return `${years} yr ${remainingMonths} mo`
}

function AccountProfileModal({ user, open, onOpenChange, onOpenAvatarModal, blockOutsideClose }) {
  const userId = user?.id ?? user?.user_id
  const userName = useMemo(() => getUserName(user), [user])
  const memberFor = useMemo(() => formatMembershipDuration(user?.created_at), [user?.created_at])
  const joinedDate = useMemo(() => formatJoinDate(user?.created_at), [user?.created_at])
  const [stats, setStats] = useState(emptyProfileStats)

  useEffect(() => {
    if (!open || !userId) return

    let ignore = false

    Promise.resolve().then(() => {
      if (!ignore) setStats({ ...emptyProfileStats, isLoading: true })
    })

    Promise.all([
      listCards({ user_id: userId }),
      transactionsService.list({ pageSize: 1 }),
    ])
      .then(([cards, transactionPage]) => {
        if (ignore) return

        const totalBalance = cards.reduce((sum, card) => {
          const nextBalance = Number(card.balance)
          return sum + (Number.isNaN(nextBalance) ? 0 : nextBalance)
        }, 0)

        setStats({
          isLoading: false,
          error: null,
          cardCount: cards.length,
          transactionCount: transactionPage.total ?? transactionPage.items?.length ?? 0,
          totalBalance,
        })
      })
      .catch(() => {
        if (!ignore) {
          setStats({
            ...emptyProfileStats,
            error: 'Profile stats are unavailable right now.',
          })
        }
      })

    return () => {
      ignore = true
    }
  }, [open, userId])

  const statItems = [
    { label: 'Member for', value: memberFor, icon: Calendar },
    { label: 'Cards', value: stats.isLoading ? '...' : stats.cardCount, icon: CreditCard },
    {
      label: 'Balance',
      value: stats.isLoading ? '...' : formatCurrency(stats.totalBalance),
      icon: Wallet,
    },
    { label: 'Transactions', value: stats.isLoading ? '...' : stats.transactionCount, icon: Receipt },
  ]

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-slate-950/35 backdrop-blur-[3px]"
        closeButtonClassName="right-5 top-5 size-8 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        className="max-h-[calc(100vh-2rem)] max-w-[580px] overflow-hidden border-border bg-popover p-0 shadow-xl shadow-slate-950/12"
        onPointerDownOutside={(e) => {
          if (blockOutsideClose) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (blockOutsideClose) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (blockOutsideClose) e.preventDefault()
        }}
      >
        <div className="border-b border-border/70 px-6 py-5 pr-16 sm:px-7">
          <DialogHeader className="mb-0 gap-1">
            <DialogTitle className="text-xl">Profile Overview</DialogTitle>
            <DialogDescription className="max-w-md leading-5">
              Basic account details and activity for your Heap profile.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-5 sm:px-7 sm:py-6">
          <section className="rounded-surface border border-border bg-card p-4 shadow-xs sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <UserAvatar
                user={user}
                useStockPlaceholder={false}
                className="h-16 w-16 rounded-full text-xl ring-4 ring-muted/40"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-semibold tracking-tight text-foreground">
                  {userName}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{user?.email}</p>
                <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Member since {joinedDate} · {memberFor}
                </p>
              </div>
              <span className="w-fit shrink-0 rounded-chip border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
                {formatRole(user?.role_name)}
              </span>
            </div>
          </section>

          <section className="mt-4 rounded-surface border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-background text-muted-foreground ring-1 ring-border">
                  <Camera className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Profile image</p>
                  <p className="text-xs text-muted-foreground">Shown in the sidebar and account header.</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-9 shrink-0 gap-2 text-xs"
                disabled={!user}
                onClick={onOpenAvatarModal}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden />
                Change photo
              </Button>
            </div>
          </section>

          {stats.error ? (
            <p className="mt-4 rounded-input border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {stats.error}
            </p>
          ) : null}

          <section className="mt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account Summary
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {statItems.map((item) => (
                <div
                  key={item.label}
                  className="flex min-h-24 items-start gap-3 rounded-input border border-border bg-card p-4"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-muted text-primary">
                    <item.icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-1.5 truncate text-lg font-semibold tracking-tight text-foreground">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

      </DialogContent>
    </DialogRoot>
  )
}

export default function SidebarAccountProfile({ user }) {
  const { notify } = useNotifications()
  const { uploadProfileAvatar } = useAuth()
  const [open, setOpen] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)

  if (!user) return null

  const userName = getUserName(user)

  async function handleAvatarUpload(file) {
    await uploadProfileAvatar(file)
    notify({ type: 'success', message: 'Profile photo updated.' })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="nav-pill group flex w-full items-center gap-3 rounded-input bg-transparent px-3 py-2.5 text-left hover:bg-primary/5"
      >
        <UserAvatar
          user={user}
          useStockPlaceholder={false}
          className="h-8 w-8 text-xs ring-1 ring-primary/15"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-sidebar-foreground">
            {userName}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {formatRole(user.role_name)}
          </span>
        </span>
      </button>

      <AccountProfileModal
        user={user}
        open={open}
        onOpenChange={setOpen}
        onOpenAvatarModal={() => setAvatarModalOpen(true)}
        blockOutsideClose={avatarModalOpen}
      />

      <AvatarUploadModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        onUpload={handleAvatarUpload}
      />
    </>
  )
}
