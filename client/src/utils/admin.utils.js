/**
 * Title-case a lookup label: "admin" → "Admin", "super_admin" → "Super Admin".
 */
export function titleCase(value) {
  return String(value ?? '')
    .split(/[._\s-]+/)
    .filter(Boolean)
    .map((chunk) => `${chunk[0].toUpperCase()}${chunk.slice(1)}`)
    .join(' ')
}

export function deriveUsers(mockUsers) {
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

export function getCardStatus(card) {
  if (card.statusName) return card.statusName
  if (card.isDisabled) return 'disabled'
  if (card.isActive) return 'active'
  return 'inactive'
}

export function getRoleBadgeVariant(role) {
  if (role === 'admin') return 'info'
  if (role === 'manager') return 'secondary'
  return 'outline'
}

export function getStatusBadgeVariant(status) {
  if (status === 'active') return 'success'
  if (status === 'expired' || status === 'cancelled' || status === 'frozen' || status === 'disabled') return 'error'
  if (status === 'inactive') return 'warning'
  return 'outline'
}

function normalizeIdentity(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getUserEmailLocal(email) {
  return email.split('@')[0] ?? ''
}

function scoreCardOwnerMatch(cardHolderName, user) {
  const holder = normalizeIdentity(cardHolderName ?? '')
  if (!holder) return 0

  const fullName = normalizeIdentity(user.fullName)
  const emailLocal = normalizeIdentity(getUserEmailLocal(user.email))

  if (holder === fullName) return 4
  if (holder === emailLocal) return 3
  if (fullName && (holder.includes(fullName) || fullName.includes(holder))) return 2
  if (emailLocal && (holder.includes(emailLocal) || emailLocal.includes(holder))) return 1
  return 0
}

export function buildCardAssignments(users, cards) {
  const cardsByUserId = new Map(users.map((user) => [user.id, []]))
  const usersById = new Map(users.map((user) => [user.id, user]))
  const unmatchedCards = []

  cards.forEach((item, index) => {
    const cardWithStableId = {
      ...item,
      id: `${item.id}-${index}`,
    }

    if (item.userId && usersById.has(item.userId)) {
      cardsByUserId.get(item.userId).push(cardWithStableId)
      return
    }

    let bestUser = null
    let bestScore = 0

    users.forEach((user) => {
      const score = scoreCardOwnerMatch(item.card?.cardHolderName, user)
      if (score > bestScore) {
        bestScore = score
        bestUser = user
      }
    })

    if (bestUser && bestScore > 0) {
      cardsByUserId.get(bestUser.id).push(cardWithStableId)
      return
    }

    unmatchedCards.push(cardWithStableId)
  })

  const usersWithCards = users.map((user) => {
    return {
      ...user,
      cards: cardsByUserId.get(user.id) ?? [],
    }
  })

  return {
    usersWithCards,
    unmatchedCards,
  }
}
