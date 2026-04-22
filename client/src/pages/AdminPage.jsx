import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import CardList from '@/components/card-view/CardList'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { paymentCardMockData } from '@/mock-data/paymentCardMockData'
import { MOCK_USERS } from '@/mock-data/userMocks'

const USER_CHIP_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Admins', value: 'admin' },
  { label: 'Managers', value: 'manager' },
  { label: 'Invited', value: 'invited' },
]

const USER_SORT_OPTIONS = [
  { label: 'Name (A-Z)', value: 'name-asc' },
  { label: 'Role', value: 'role-asc' },
  { label: 'Status', value: 'status-asc' },
]

const CARD_STATUS_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Inactive', value: 'inactive' },
]

const CARD_SORT_OPTIONS = [
  { label: 'Status', value: 'status-asc' },
  { label: 'Brand', value: 'brand-asc' },
]

const USER_PAGE_SIZE = 6
const CARD_PAGE_SIZE = 4

function deriveUsers(mockUsers) {
  return mockUsers.map((user, index) => {
    const namePart = user.email.split('@')[0]
    const fullName = namePart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((chunk) => `${chunk[0].toUpperCase()}${chunk.slice(1)}`)
      .join(' ')

    const role = index % 10 === 0 ? 'admin' : index % 3 === 0 ? 'manager' : 'user'

    return {
      id: `user-${index + 1}`,
      fullName: fullName || 'Unknown User',
      email: user.email,
      role,
      status: index % 7 === 0 ? 'invited' : 'active',
      lastLogin: `2026-04-${String((index % 26) + 1).padStart(2, '0')} 10:${String(
        (index * 3) % 60
      ).padStart(2, '0')}`,
    }
  })
}

function getCardStatus(card) {
  if (card.isDisabled) return 'disabled'
  if (card.isActive) return 'active'
  return 'inactive'
}

function getRoleBadgeVariant(role) {
  if (role === 'admin') return 'info'
  if (role === 'manager') return 'secondary'
  return 'outline'
}

function getStatusBadgeVariant(status) {
  if (status === 'active') return 'success'
  if (status === 'disabled') return 'error'
  if (status === 'inactive') return 'warning'
  return 'outline'
}

function withLast4(cardNumber, last4) {
  const digits = cardNumber.replace(/\D/g, '')
  const prefix = digits.slice(0, Math.max(0, digits.length - 4))
  const padded = `${prefix}${last4}`.slice(-digits.length)
  return padded.replace(/(.{4})/g, '$1 ').trim()
}

function buildUserCard(template, user, userIndex, slot) {
  const seed = userIndex * 2 + slot
  const rawLast4 = `${1000 + seed}`
  const isDisabled = seed % 4 === 0
  const isActive = !isDisabled && seed % 3 === 0

  return {
    id: `${template.id}-u${userIndex}-s${slot}`,
    card: {
      ...template.card,
      cardHolderName: user.fullName,
      cardNumber: withLast4(template.card.cardNumber, rawLast4.slice(-4)),
      isActive,
      isDisabled,
    },
  }
}

function getUserCards(user, userIndex) {
  const firstTemplate = paymentCardMockData[userIndex % paymentCardMockData.length]
  const secondTemplate = paymentCardMockData[(userIndex + 1) % paymentCardMockData.length]

  return [buildUserCard(firstTemplate, user, userIndex, 0), buildUserCard(secondTemplate, user, userIndex, 1)]
}

export default function AdminPage() {
  const [searchParams] = useSearchParams()
  const sectionParam = searchParams.get('section')
  const activeSection = sectionParam === 'cards' ? 'cards' : 'users'

  const [userSearch, setUserSearch] = useState('')
  const [userChipFilter, setUserChipFilter] = useState('all')
  const [userSort, setUserSort] = useState('name-asc')
  const [cardStatusFilter, setCardStatusFilter] = useState('all')
  const [cardSort, setCardSort] = useState('status-asc')
  const [selectedUser, setSelectedUser] = useState(null)
  const [focusedUserId, setFocusedUserId] = useState(null)
  const [showAllCards, setShowAllCards] = useState(false)
  const [userPage, setUserPage] = useState(1)
  const [cardPage, setCardPage] = useState(1)
  const [feedbackToast, setFeedbackToast] = useState('')

  const users = useMemo(() => deriveUsers(MOCK_USERS), [])

  const usersWithCards = useMemo(() => {
    return users.map((user, index) => ({
      ...user,
      cards: getUserCards(user, index),
    }))
  }, [users])

  const filteredUsersWithCards = useMemo(() => {
    return usersWithCards.filter((user) => {
      const matchesSearch =
        user.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearch.toLowerCase())

      const matchesChip =
        userChipFilter === 'all' ||
        (userChipFilter === 'invited' ? user.status === 'invited' : user.role === userChipFilter)

      return matchesSearch && matchesChip
    })
  }, [userChipFilter, userSearch, usersWithCards])

  useEffect(() => {
    if (!focusedUserId) return
    const stillVisible = filteredUsersWithCards.some((user) => user.id === focusedUserId)
    if (!stillVisible) {
      setFocusedUserId(null)
      setShowAllCards(false)
    }
  }, [filteredUsersWithCards, focusedUserId])

  useEffect(() => {
    if (showAllCards) return

    if (filteredUsersWithCards.length === 1) {
      const onlyUser = filteredUsersWithCards[0]
      if (focusedUserId !== onlyUser.id) {
        setFocusedUserId(onlyUser.id)
      }
      return
    }

    if (filteredUsersWithCards.length === 0) {
      setFocusedUserId(null)
    }
  }, [filteredUsersWithCards, focusedUserId, showAllCards])

  const sortedUsers = useMemo(() => {
    const copy = [...filteredUsersWithCards]
    copy.sort((a, b) => {
      if (userSort === 'role-asc') return a.role.localeCompare(b.role)
      if (userSort === 'status-asc') return a.status.localeCompare(b.status)
      return a.fullName.localeCompare(b.fullName)
    })
    return copy
  }, [filteredUsersWithCards, userSort])

  const scopedUsersForCards = useMemo(() => {
    if (showAllCards) return sortedUsers
    if (!focusedUserId) return []
    return sortedUsers.filter((user) => user.id === focusedUserId)
  }, [focusedUserId, showAllCards, sortedUsers])

  const activeUserForCards = useMemo(() => {
    if (!focusedUserId) return null
    return sortedUsers.find((user) => user.id === focusedUserId) ?? null
  }, [focusedUserId, sortedUsers])

  const filteredCards = useMemo(() => {
    const cardsFromScopedUsers = scopedUsersForCards.flatMap((user) =>
      user.cards.map((item, cardIndex) => ({
        ...item,
        id: `${user.id}-${item.id}-${cardIndex}`,
        ownerName: user.fullName,
        ownerEmail: user.email,
      }))
    )

    return cardsFromScopedUsers.filter(({ card }) => {
      if (cardStatusFilter === 'all') return true
      return getCardStatus(card) === cardStatusFilter
    })
  }, [cardStatusFilter, scopedUsersForCards])

  const sortedCards = useMemo(() => {
    const copy = [...filteredCards]
    copy.sort((a, b) => {
      if (cardSort === 'brand-asc') return a.card.brand.localeCompare(b.card.brand)
      return getCardStatus(a.card).localeCompare(getCardStatus(b.card))
    })
    return copy
  }, [cardSort, filteredCards])

  const totalUserPages = Math.max(1, Math.ceil(sortedUsers.length / USER_PAGE_SIZE))
  const totalCardPages = Math.max(1, Math.ceil(sortedCards.length / CARD_PAGE_SIZE))

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * USER_PAGE_SIZE
    return sortedUsers.slice(start, start + USER_PAGE_SIZE)
  }, [sortedUsers, userPage])

  const paginatedCards = useMemo(() => {
    const start = (cardPage - 1) * CARD_PAGE_SIZE
    return sortedCards.slice(start, start + CARD_PAGE_SIZE)
  }, [cardPage, sortedCards])

  const kpiTotals = useMemo(() => {
    const allCards = usersWithCards.flatMap((user) => user.cards)
    return {
      totalUsers: usersWithCards.length,
      activeUsers: usersWithCards.filter((user) => user.status === 'active').length,
      totalCards: allCards.length,
      disabledCards: allCards.filter((item) => item.card.isDisabled).length,
    }
  }, [usersWithCards])

  useEffect(() => {
    setUserPage(1)
  }, [userChipFilter, userSearch, userSort])

  useEffect(() => {
    setCardPage(1)
  }, [cardSort, cardStatusFilter, focusedUserId, userChipFilter, userSearch, userSort])

  useEffect(() => {
    if (!feedbackToast) return
    const timeout = setTimeout(() => setFeedbackToast(''), 1800)
    return () => clearTimeout(timeout)
  }, [feedbackToast])

  function resetAllFilters() {
    setUserSearch('')
    setUserChipFilter('all')
    setUserSort('name-asc')
    setCardStatusFilter('all')
    setCardSort('status-asc')
    setFocusedUserId(null)
    setShowAllCards(false)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage users and cards with mock controls for the initial admin experience.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total Users</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">{kpiTotals.totalUsers}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Active Users</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">{kpiTotals.activeUsers}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total Cards</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">{kpiTotals.totalCards}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Disabled Cards</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">{kpiTotals.disabledCards}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <article
          className={`rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 xl:col-span-7 ${
            activeSection === 'cards' ? 'xl:order-2' : ''
          }`}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Admin Users</h2>
              <p className="text-xs text-muted-foreground">Search and filter users (mock data)</p>
            </div>

            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
              <Input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search name or email"
                className="sm:w-56"
              />
              <Select
                value={userSort}
                onChange={(event) => setUserSort(event.target.value)}
                options={USER_SORT_OPTIONS}
              />
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {USER_CHIP_OPTIONS.map((chip) => (
              <Button
                key={chip.value}
                size="sm"
                variant={userChipFilter === chip.value ? 'default' : 'outline'}
                onClick={() => setUserChipFilter(chip.value)}
              >
                {chip.label}
              </Button>
            ))}
          </div>

          {paginatedUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/50 p-6 text-center">
              <p className="font-medium text-card-foreground">No users found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try different filters or reset the current search criteria.
              </p>
              <Button className="mt-4" variant="outline" onClick={resetAllFilters}>
                Reset filters
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-card-foreground">{user.fullName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={user.status === 'active' ? 'success' : 'warning'}>
                            {user.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user)
                              setFocusedUserId(user.id)
                              setShowAllCards(false)
                            }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {paginatedUsers.map((user) => (
                  <article key={user.id} className="rounded-2xl border border-border bg-background p-3">
                    <p className="font-medium text-card-foreground">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                      <Badge variant={user.status === 'active' ? 'success' : 'warning'}>
                        {user.status}
                      </Badge>
                    </div>
                    <Button
                      className="mt-3"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user)
                        setFocusedUserId(user.id)
                      }}
                    >
                      View
                    </Button>
                  </article>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                  disabled={userPage === 1}
                >
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {userPage} / {totalUserPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserPage((page) => Math.min(totalUserPages, page + 1))}
                  disabled={userPage === totalUserPages}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </article>

        <article
          className={`rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 xl:col-span-5 ${
            activeSection === 'cards' ? 'xl:order-1' : ''
          }`}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Cards Management</h2>
              <p className="text-xs text-muted-foreground">Filter card states and review mock actions</p>
              {activeUserForCards && !showAllCards && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Cards for: <span className="font-medium text-card-foreground">{activeUserForCards.fullName}</span>
                </p>
              )}
            </div>

            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[1fr_1fr_auto] sm:items-center">
              <Select
                value={cardStatusFilter}
                onChange={(event) => setCardStatusFilter(event.target.value)}
                options={CARD_STATUS_OPTIONS}
                className="sm:w-44"
              />
              <Select
                value={cardSort}
                onChange={(event) => setCardSort(event.target.value)}
                options={CARD_SORT_OPTIONS}
                className="sm:w-36"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFocusedUserId(null)
                  setShowAllCards(true)
                }}
                disabled={showAllCards}
              >
                Show all users
              </Button>
            </div>
          </div>

          {focusedUserId && !showAllCards && (
            <p className="mb-3 text-xs text-muted-foreground">
              Showing cards only for selected user from the users table.
            </p>
          )}

          {!showAllCards && !focusedUserId && (
            <div className="mb-3 rounded-2xl border border-dashed border-border bg-background/50 p-4 text-xs text-muted-foreground">
              Select a user via <span className="font-medium text-card-foreground">View</span> to load their cards.
            </div>
          )}

          {paginatedCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/50 p-6 text-center">
              <p className="font-medium text-card-foreground">No cards found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Update user or status filters to see card results.
              </p>
              <Button className="mt-4" variant="outline" onClick={resetAllFilters}>
                Reset filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3">
                {paginatedCards.map((item) => {
                  const status = getCardStatus(item.card)

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-card-foreground">{item.ownerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.card.brand.toUpperCase()} •••• {item.card.cardNumber.slice(-4)}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.ownerEmail}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setFeedbackToast('Action disabled in demo mode')}
                        >
                          Manage
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCardPage((page) => Math.max(1, page - 1))}
                  disabled={cardPage === 1}
                >
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {cardPage} / {totalCardPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCardPage((page) => Math.min(totalCardPages, page + 1))}
                  disabled={cardPage === totalCardPages}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </article>

        <article className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 xl:col-span-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-card-foreground">Card Preview Grid</h2>
            <p className="text-xs text-muted-foreground">Reused from card view components</p>
          </div>
          <CardList items={paginatedCards} />
        </article>
      </section>

      <DialogRoot open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Preview mock user information and assigned cards for admin review.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Name</p>
                  <p className="mt-1 font-medium text-card-foreground">{selectedUser.fullName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Email</p>
                  <p className="mt-1 font-medium text-card-foreground">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Role</p>
                  <div className="mt-1">
                    <Badge variant={getRoleBadgeVariant(selectedUser.role)}>{selectedUser.role}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <Badge variant={selectedUser.status === 'active' ? 'success' : 'warning'}>
                      {selectedUser.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Cards</p>
                  <p className="mt-1 font-medium text-card-foreground">{selectedUser.cards.length}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Active Cards</p>
                  <p className="mt-1 font-medium text-card-foreground">
                    {selectedUser.cards.filter((item) => item.card.isActive && !item.card.isDisabled).length}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Last Login</p>
                  <p className="mt-1 font-medium text-card-foreground">{selectedUser.lastLogin}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  User Cards (Miniature)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedUser.cards.map((item) => (
                    <article
                      key={`${selectedUser.id}-${item.id}`}
                      className="rounded-2xl border border-border bg-card p-3"
                    >
                      <p className="text-sm font-semibold text-card-foreground">{item.card.cardHolderName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.card.brand.toUpperCase()} •••• {item.card.cardNumber.slice(-4)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">Expires {item.card.expiryDate}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </DialogRoot>

      {feedbackToast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg">
          {feedbackToast}
        </div>
      )}
    </div>
  )
}
